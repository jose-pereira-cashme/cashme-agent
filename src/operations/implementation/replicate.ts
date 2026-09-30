import type { AgentClient } from "../../agent/types.ts";
import type { GitClient, GithubClient } from "../../tools/types.ts";
import type { JiraIssue, RepoEntry } from "../../types/domain.ts";
import type { Logger, ReplicaOutcome } from "../types.ts";
import { config } from "../../config.ts";
import { buildPrBody, RESOLVE_CONFLICT_SYSTEM_PROMPT } from "./utils.ts";

const RESOLVE_TOOLS = ["Read", "Grep", "Glob", "Edit", "Write"];

export async function replicateToBases(ctx: {
  agent: AgentClient;
  git: GitClient;
  github: GithubClient;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  issue: JiraIssue;
  summary: string;
  log: Logger;
}): Promise<ReplicaOutcome[]> {
  const { agent, git, github, repo, cwd, branch, issue, summary, log } = ctx;
  const outcomes: ReplicaOutcome[] = [];

  for (const base of config.replicaBases) {
    if (base === repo.defaultBranch) continue; // the work branch already sits on it
    if (!(await git.hasRemoteBranch(cwd, base))) {
      log(`[${repo.name}] base '${base}' not on the remote — replication skipped`);
      continue;
    }

    const replicaBranch = `${branch}-${base}`;
    try {
      const result = await git.replicateCommits(cwd, {
        branch: replicaBranch,
        base,
        fromRef: branch,
        fromBase: `origin/${repo.defaultBranch}`,
        onConflict: (files) => resolveConflict({ agent, repo, cwd, base, files, issue, summary, log }),
      });
      if (!result.replicated) {
        log(`[${repo.name}] base '${base}' already has the change — no replica PR`);
        outcomes.push({ base, branch: replicaBranch, upToDate: true });
        continue;
      }

      const { resolvedFiles } = result;
      await git.push(cwd, replicaBranch);
      const prUrl = await github.createPr({
        cwd,
        base,
        head: replicaBranch,
        title: `${replicaBranch} - Cashme Agent(IA)`,
        body: buildPrBody({ issueKey: issue.key, summary, base, sourceBranch: branch }),
      });
      log(`[${repo.name}] replica on ${base}: ${prUrl}`);
      outcomes.push({
        base,
        branch: replicaBranch,
        prUrl,
        ...(resolvedFiles.length > 0 ? { resolvedFiles } : {}),
      });
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

async function resolveConflict(args: {
  agent: AgentClient;
  repo: RepoEntry;
  cwd: string;
  base: string;
  files: string[];
  issue: JiraIssue;
  summary: string;
  log: Logger;
}): Promise<void> {
  const { agent, repo, cwd, base, files, issue, summary, log } = args;
  log(`[${repo.name}] conflict on ${base} in ${files.join(", ")} — asking the agent to merge`);

  const prompt = [
    `Replicating the work for ${issue.key} onto '${base}' stopped on a cherry-pick conflict.`,
    `Ticket: ${issue.summary}`,
    summary ? `What the incoming commit does:\n${summary}` : "",
    `Files left unmerged — resolve every one of them:\n${files.map((f) => `- ${f}`).join("\n")}`,
    `Keep what '${base}' already has and land the incoming change alongside it.`,
  ].filter(Boolean).join("\n\n");

  const reply = await agent.run({
    prompt,
    systemPrompt: RESOLVE_CONFLICT_SYSTEM_PROMPT,
    allowedTools: RESOLVE_TOOLS,
    cwd,
  });
  log(`[${repo.name}] resolver on ${base}: ${reply.trim().slice(0, 300)}`);
}
