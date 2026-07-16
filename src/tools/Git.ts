import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../utils/exec.ts";
import type { RepoEntry } from "./Catalog.ts";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const MIRRORS_DIR = process.env.MIRRORS_DIR ?? join(tmpdir(), "cashme-agent-mirrors");

export interface GitClient {
  ensureMirror(repo: RepoEntry): Promise<string>;
  makeWorkingCopy(repo: RepoEntry, jobId: string): Promise<string>;
  createBranch(cwd: string, branch: string, base: string): Promise<void>;
  commitAll(cwd: string, message: string): Promise<void>;
  push(cwd: string, branch: string): Promise<void>;
  cleanup(cwd: string): Promise<void>;
}

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
    return url.replace("https://github.com/", `https://x-access-token:${GITHUB_TOKEN}@github.com/`);
  }

  function mirrorPath(repo: RepoEntry): string {
    return join(MIRRORS_DIR, `${repo.name}.git`);
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
    async commitAll(cwd, message) {
      await git(["add", "-A"], cwd);
      await git(["-c", "user.name=cashme-agent", "-c", "user.email=agent@cashme.com.br",
        "commit", "-m", message], cwd);
    },
    async push(cwd, branch) {
      // Force so a retry of the same ticket overwrites the automation-owned branch
      // from a previous attempt instead of being rejected as non-fast-forward.
      await git(["push", "--force", "-u", "origin", branch], cwd);
    },
    async cleanup(cwd) {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}
