import { existsSync } from "node:fs";
import { chmod, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../utils/exec.ts";
import type { RepoEntry } from "../types/domain.ts";
import type { GitClient } from "./types.ts";
import { config } from "../config.ts";

const redact = (s: string) => s.replace(/x-access-token:[^@]+@/g, "x-access-token:***@");

const IDENTITY = ["-c", "user.name=cashme-agent", "-c", "user.email=agent@cashme.com.br"];
const NO_HOOKS = ["-c", "core.hooksPath=/dev/null"];
const MAX_CONFLICT_RESOLUTIONS = 3;

function gitRun(args: string[], cwd?: string) {
  return run("git", args, { cwd, env: { HUSKY: "0", GIT_EDITOR: "true" } });
}

async function removeDir(path: string, log?: (msg: string) => void): Promise<void> {
  const attempt = () => rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  try {
    await attempt();
    return;
  } catch {
    // Fall through to the read-only fallback below.
  }
  try {
    const entries = await readdir(path, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      // Directories keep their traversal bit — 0o666 on a directory would make
      // the tree unreadable and so undeletable.
      const mode = entry.isDirectory() ? 0o777 : 0o666;
      await chmod(join(entry.parentPath, entry.name), mode).catch(() => {});
    }
    await attempt();
  } catch (err) {
    log?.(`cleanup failed for ${path}: ${(err as Error).message}`);
  }
}

// Paths git considers unmerged. Non-empty exactly while a cherry-pick is parked
// on a conflict, which is what separates a conflict from any other stop.
async function unmergedPaths(cwd: string): Promise<string[]> {
  const r = await gitRun(["diff", "--name-only", "--diff-filter=U"], cwd);
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

// `git add` happily stages a file still full of conflict markers, so a resolver
// that edited around them would produce a commit that builds nowhere. Checked
// before the cherry-pick is allowed to continue.
async function conflictMarkers(cwd: string, files: string[]): Promise<string[]> {
  const left: string[] = [];
  for (const file of files) {
    try {
      if (/^<{7}( |$)/m.test(await readFile(join(cwd, file), "utf8"))) left.push(file);
    } catch {
      // Unreadable means the resolution deleted it — nothing to inspect.
    }
  }
  return left;
}

export function Git(): GitClient {
  async function git(args: string[], cwd?: string): Promise<string> {
    const r = await gitRun(args, cwd);
    if (r.code !== 0) {
      throw new Error(`git ${redact(args.join(" "))} failed: ${redact(r.stderr || r.stdout)}`);
    }
    return r.stdout;
  }

  function authUrl(url: string): string {
    return url.replace("https://github.com/", `https://x-access-token:${config.github.token}@github.com/`);
  }

  function mirrorPath(repo: RepoEntry): string {
    return join(config.mirrorsDir, `${repo.name}.git`);
  }

  async function remoteBranchExists(cwd: string, branch: string): Promise<boolean> {
    const r = await gitRun(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`], cwd);
    return r.code === 0;
  }

  return {
    async ensureMirror(repo) {
      const path = mirrorPath(repo);
      if (!existsSync(path)) {
        await git(["clone", "--mirror", authUrl(repo.url), path]);
      } else {
        await git(["remote", "update", "--prune"], path);
      }
      return path;
    },
    async makeWorkingCopy(repo, jobId) {
      const dest = join(tmpdir(), `job-${jobId}`);
      await removeDir(dest);
      try {
        await git(["clone", mirrorPath(repo), dest]);
        await git(["remote", "set-url", "origin", authUrl(repo.url)], dest);
      } catch (err) {
        // The caller never learns this path, so it has to be dropped here.
        await removeDir(dest);
        throw err;
      }
      return dest;
    },
    async createBranch(cwd, branch, base) {
      if (await remoteBranchExists(cwd, branch)) {
        // Branch already exists on the remote — continue from its tip so we build
        // on the previous attempt instead of discarding it.
        await git(["checkout", "-b", branch, `origin/${branch}`], cwd);
      } else {
        await git(["checkout", base], cwd);
        await git(["checkout", "-b", branch], cwd);
      }
    },
    async diff(cwd, base) {
      return git([
        "diff", `${base}..HEAD`, "--", ".",
        ":(exclude,glob)**/yarn.lock",
        ":(exclude,glob)**/package-lock.json",
        ":(exclude,glob)**/pnpm-lock.yaml",
      ], cwd);
    },
    async status(cwd) {
      const out = await git(["status", "--porcelain"], cwd);
      return out.split("\n").filter(Boolean).map((line) => ({
        // Porcelain is "XY <path>"; "??" marks an untracked file.
        path: line.slice(3).replace(/^"|"$/g, ""),
        untracked: line.slice(0, 2) === "??",
      }));
    },
    async restoreFile(cwd, path, untracked) {
      if (untracked) {
        await rm(join(cwd, path), { force: true });
      } else {
        await git(["checkout", "HEAD", "--", path], cwd);
      }
    },
    async commitAll(cwd, message) {
      await git(["add", "-A"], cwd);
      await git([...NO_HOOKS, ...IDENTITY, "commit", "--no-verify", "-m", message], cwd);
    },
    async hasRemoteBranch(cwd, branch) {
      return remoteBranchExists(cwd, branch);
    },
    async replicateCommits(cwd, { branch, base, fromRef, fromBase, onConflict }) {
      const commits = (await git([
        "rev-list", "--reverse", "--no-merges", "--cherry-pick", "--right-only",
        `origin/${base}...${fromRef}`, "--not", fromBase,
      ], cwd)).split("\n").filter(Boolean);
      // Nothing missing is the steady state of a re-run, not an error.
      if (commits.length === 0) return { replicated: false };

      // -B so a leftover local branch from an earlier base is rebuilt from
      // scratch: the replica is always base + the commits the base still lacks.
      await git(["checkout", "-B", branch, `origin/${base}`], cwd);

      const resolved = new Set<string>();
      const abort = async (msg: string): Promise<never> => {
        await gitRun(["cherry-pick", "--abort"], cwd);
        throw new Error(msg);
      };

      let r = await gitRun([...NO_HOOKS, ...IDENTITY, "cherry-pick", ...commits], cwd);
      let budget = commits.length + MAX_CONFLICT_RESOLUTIONS;
      while (r.code !== 0 && budget-- > 0) {
        if (/is now empty|nothing to commit/i.test(`${r.stderr}\n${r.stdout}`)) {
          r = await gitRun([...NO_HOOKS, ...IDENTITY, "cherry-pick", "--skip"], cwd);
          continue;
        }

        const conflicted = await unmergedPaths(cwd);
        if (conflicted.length === 0) break; // stopped for some other reason
        if (!onConflict) {
          return await abort(`cherry-pick onto ${base} conflicted in: ${conflicted.join(", ")}`);
        }

        await onConflict(conflicted);

        const withMarkers = await conflictMarkers(cwd, conflicted);
        if (withMarkers.length > 0) {
          return await abort(`cherry-pick onto ${base}: conflict markers left in: ${withMarkers.join(", ")}`);
        }

        for (const f of conflicted) resolved.add(f);
        await git(["add", "-A"], cwd);

        const stillUnmerged = await unmergedPaths(cwd);
        if (stillUnmerged.length > 0) {
          return await abort(`cherry-pick onto ${base}: still unmerged after resolution: ${stillUnmerged.join(", ")}`);
        }
        r = await gitRun([...NO_HOOKS, ...IDENTITY, "cherry-pick", "--continue"], cwd);
      }

      if (r.code !== 0) {
        return await abort(`cherry-pick onto ${base} failed: ${redact(r.stderr || r.stdout)}`);
      }

      const ahead = (await git(["rev-list", "--count", `origin/${base}..HEAD`], cwd)).trim();
      if (ahead === "0") return { replicated: false };
      return { replicated: true, resolvedFiles: [...resolved] };
    },
    async push(cwd, branch) {
      await git(["push", "--force-with-lease", "-u", "origin", branch], cwd);
    },
    async cleanup(cwd) {
      await removeDir(cwd, (msg) => console.log(`[git] ${msg}`));
    },
  };
}
