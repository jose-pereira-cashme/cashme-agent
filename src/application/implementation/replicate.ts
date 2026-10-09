import type { Issue } from "../../domain/issue.ts";
import type { RepoEntry } from "../../domain/repo.ts";
import type { ReplicaOutcome } from "../../domain/outcomes.ts";
import type { AgentClient, CodeHost, GitClient, Logger, Prompts, Settings } from "../ports.ts";
import { buildPrBody } from "./utils.ts";

const RESOLVE_TOOLS = ["Read", "Grep", "Glob", "Edit", "Write"];

export async function replicateToBases(ctx: {
  agent: AgentClient;
  git: GitClient;
  codeHost: CodeHost;
  prompts: Prompts;
  settings: Settings;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  issue: Issue;
  summary: string;
  log: Logger;
}): Promise<ReplicaOutcome[]> {
  const { agent, git, codeHost, prompts, settings, repo, cwd, branch, issue, summary, log } = ctx;
  const outcomes: ReplicaOutcome[] = [];

  for (const base of settings.replicaBases) {
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
        onConflict: (files) => resolveConflict({ agent, prompts, repo, cwd, base, files, issue, summary, log }),
      });
      if (!result.replicated) {
        log(`[${repo.name}] base '${base}' already has the change — no replica PR`);
        outcomes.push({ base, branch: replicaBranch, upToDate: true });
        continue;
      }

      const { resolvedFiles } = result;
      await git.push(cwd, replicaBranch);
      const prUrl = await codeHost.createPr({
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
  prompts: Prompts;
  repo: RepoEntry;
  cwd: string;
  base: string;
  files: string[];
  issue: Issue;
  summary: string;
  log: Logger;
}): Promise<void> {
  const { agent, prompts, repo, cwd, base, files, issue, summary, log } = args;
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
    systemPrompt: prompts.implementation.resolveConflict,
    allowedTools: RESOLVE_TOOLS,
    cwd,
  });
  log(`[${repo.name}] resolver on ${base}: ${reply.trim().slice(0, 300)}`);
}
