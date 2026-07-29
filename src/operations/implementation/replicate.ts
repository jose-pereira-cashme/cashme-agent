import type { GitClient, GithubClient } from "../../tools/types.ts";
import type { JiraIssue, RepoEntry } from "../../types/domain.ts";
import type { Logger, ReplicaOutcome } from "../types.ts";
import { config } from "../../config.ts";
import { buildPrBody } from "./utils.ts";

export async function replicateToBases(ctx: {
  git: GitClient;
  github: GithubClient;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  issue: JiraIssue;
  summary: string;
  log: Logger;
}): Promise<ReplicaOutcome[]> {
  const { git, github, repo, cwd, branch, issue, summary, log } = ctx;
  const outcomes: ReplicaOutcome[] = [];

  for (const base of config.replicaBases) {
    if (base === repo.defaultBranch) continue; // the work branch already sits on it
    if (!(await git.hasRemoteBranch(cwd, base))) {
      log(`[${repo.name}] base '${base}' not on the remote — replication skipped`);
      continue;
    }

    const replicaBranch = `${branch}-${base}`;
    try {
      await git.replicateCommits(cwd, {
        branch: replicaBranch,
        base,
        fromRef: branch,
        fromBase: `origin/${repo.defaultBranch}`,
      });
      await git.push(cwd, replicaBranch);
      const prUrl = await github.createPr({
        cwd,
        base,
        head: replicaBranch,
        title: `${replicaBranch} - Cashme Agent(IA)`,
        body: buildPrBody({ issueKey: issue.key, summary, base, sourceBranch: branch }),
      });
      log(`[${repo.name}] replica on ${base}: ${prUrl}`);
      outcomes.push({ base, branch: replicaBranch, prUrl });
    } catch (err) {
      log(`[${repo.name}] replica on ${base} failed: ${(err as Error).message}`);
      outcomes.push({
        base,
        branch: replicaBranch,
        reason: `falha ao replicar em ${base}: ${(err as Error).message}`.slice(0, 500),
      });
    }
  }

  return outcomes;
}
