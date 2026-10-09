import type { AgentAnalyses } from "../../domain/analysis.ts";
import type { Issue } from "../../domain/issue.ts";
import type { Deps } from "../ports.ts";
import { parseAgentJson } from "../agentOutput.ts";

export async function analyseIssue(deps: Deps, issue: Issue): Promise<AgentAnalyses> {
  const { agent, prompts } = deps;
  const catalog = deps.catalog.load();
  const log = (msg: string) => console.log(`[analyse ${issue.key}] ${msg}`);

  const list = catalog.repos.map((r) => `- ${r.name}: ${r.description}`).join("\n");
  const docs = issue.linkedDocs ? `\n\nLinked documentation:\n${issue.linkedDocs}` : "";
  const comments = issue.comments ? `\n\nTicket comments (chronological):\n${issue.comments}` : "";
  const systems = issue.systemFields ? `\n\nTicket system fields:\n${issue.systemFields}` : "";
  const prompt = [
    `Jira issue ${issue.key}`,
    `Title: ${issue.summary}`,
    `Description:\n${issue.description}${systems}${docs}${comments}`,
    ``,
    `Available repositories:`,
    list,
    ``,
    prompts.triage.instructions,
  ].join("\n");

  if (issue.systemFields) log(`system fields: ${issue.systemFields.replace(/\n/g, " | ")}`);

  // Pure text classification — no file tools.
  const out = await agent.query(prompt, prompts.triage.system, []);
  const analyses = parseAnalyses(out);
  log(`taskType=${analyses.taskType} repos=[${analyses.repoNames.join(",")}]`);
  return analyses;
}

function parseAnalyses(raw: string): AgentAnalyses {
  const parsed = parseAgentJson(raw);
  if (!parsed) {
    throw new Error(`agent returned no JSON classification:\n${raw}`.slice(0, 1000));
  }
  const taskType: AgentAnalyses["taskType"] =
    parsed.taskType === "implementation" || parsed.taskType === "research" ? parsed.taskType : "other";

  return {
    taskType,
    repoNames: Array.isArray(parsed.repoNames) ? parsed.repoNames.map(String) : [],
    reason: String(parsed.reason ?? ""),
    userPrompt: String(parsed.userPrompt ?? ""),
  };
}
