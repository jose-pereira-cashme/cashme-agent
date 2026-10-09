import type { Issue } from "../../domain/issue.ts";
import type { AgentClient, Logger, Prompts } from "../ports.ts";
import type { PreparedRepo } from "./types.ts";
import { issueContextBlocks } from "../promptBlocks.ts";

// Phase 2 — produces a read-only plan spanning every prepared repo.
// Best-effort: a failed or empty plan returns "" so implementation proceeds
// without one.
export async function buildPlan(args: {
  agent: AgentClient;
  prompts: Prompts;
  issue: Issue;
  prepared: PreparedRepo[];
  userPrompt: string;
  log: Logger;
}): Promise<string> {
  const { agent, prompts, issue, prepared, userPrompt, log } = args;
  if (prepared.length === 0) return "";

  const repoList = prepared.map(({ repo, cwd }) => `- ${repo.name} (${cwd}): ${repo.description}`).join("\n");
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    ...issueContextBlocks(issue),
    `Task:\n${userPrompt}`,
    `Target repositories (read-only working copies):\n${repoList}`,
  ].filter(Boolean).join("\n\n");

  try {
    // No cwd — the plan reads across all working copies via the paths above
    // (same pattern as the research operation).
    const plan = await agent.plan({ prompt, systemPrompt: prompts.implementation.plan });
    return plan.trim();
  } catch (err) {
    log(`planning failed (non-fatal): ${(err as Error).message}`);
    return "";
  }
}
