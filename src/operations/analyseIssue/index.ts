import type { AgentAnalyses, JiraIssue } from "../../types/domain.ts";
import { Catalog } from "../../tools/Catalog.ts";
import { Agent } from "../../agent/index.ts";
import { readPrompt } from "../../utils/prompts.ts";
import { parseAgentJson } from "../../utils/parseAgentJson.ts";

const TRIAGE_SYSTEM_PROMPT: string = readPrompt("triage", "system");
const TRIAGE_INSTRUCTIONS: string = readPrompt("triage", "instructions");

export async function analyseIssue(issue: JiraIssue): Promise<AgentAnalyses> {
  const agent = Agent();
  const catalog = Catalog();
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
    TRIAGE_INSTRUCTIONS,
  ].join("\n");

  if (issue.systemFields) log(`system fields: ${issue.systemFields.replace(/\n/g, " | ")}`);

  // Pure text classification — no file tools.
  const out = await agent.query(prompt, TRIAGE_SYSTEM_PROMPT, []);
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
