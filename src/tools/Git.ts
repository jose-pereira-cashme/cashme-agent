import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../utils/exec.ts";
import type { RepoEntry } from "../types/domain.ts";
import type { GitClient } from "./types.ts";
import { config } from "../config.ts";

const redact = (s: string) => s.replace(/x-access-token:[^@]+@/g, "x-access-token:***@");

export function Git(): GitClient {
  async function git(args: string[], cwd?: string): Promise<string> {
    const r = await run("git", args, { cwd });
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
    const r = await run("git", ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`], { cwd });
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
      await git(["clone", mirrorPath(repo), dest]);
      await git(["remote", "set-url", "origin", authUrl(repo.url)], dest);
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
      await git(["-c", "user.name=cashme-agent", "-c", "user.email=agent@cashme.com.br",
        "commit", "-m", message], cwd);
    },
    async push(cwd, branch) {
      await git(["push", "--force-with-lease", "-u", "origin", branch], cwd);
    },
    async cleanup(cwd) {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}
