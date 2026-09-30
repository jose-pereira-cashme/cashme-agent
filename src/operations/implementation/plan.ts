import type { AgentClient } from "../../agent/types.ts";
import type { JiraIssue } from "../../types/domain.ts";
import type { Logger, PreparedRepo } from "../types.ts";
import { PLAN_SYSTEM_PROMPT } from "./utils.ts";
import { formatReferenceImages } from "../../utils/prompts.ts";

// Phase 2 — produces a read-only plan spanning every prepared repo.
// Best-effort: a failed or empty plan returns "" so implementation proceeds
// without one.
export async function buildPlan(args: {
  agent: AgentClient;
  issue: JiraIssue;
  prepared: PreparedRepo[];
  userPrompt: string;
  log: Logger;
}): Promise<string> {
  const { agent, issue, prepared, userPrompt, log } = args;
  if (prepared.length === 0) return "";

  const repoList = prepared.map(({ repo, cwd }) => `- ${repo.name} (${cwd}): ${repo.description}`).join("\n");
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    `Description:\n${issue.description}`,
    issue.linkedDocs ? `Linked documentation:\n${issue.linkedDocs}` : "",
    formatReferenceImages(issue),
    issue.comments ? `Ticket comments (chronological):\n${issue.comments}` : "",
    `Task:\n${userPrompt}`,
    `Target repositories (read-only working copies):\n${repoList}`,
  ].filter(Boolean).join("\n\n");

  try {
    // No cwd — the plan reads across all working copies via the paths above
    // (same pattern as the research operation).
    const plan = await agent.plan({ prompt, systemPrompt: PLAN_SYSTEM_PROMPT });
    return plan.trim();
  } catch (err) {
    log(`planning failed (non-fatal): ${(err as Error).message}`);
    return "";
  }
}
