import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentAnalyses, JiraIssue } from "../HandleWebhook.ts";
import { Catalog } from "../../tools/Catalog.ts";
import { Agent } from "../../agent/index.ts";

const PROMPTS_PATH = process.env.PROMPTS_PATH ?? join(process.cwd(), "prompts.json");
const prompts = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));

const TRIAGE_SYSTEM_PROMPT: string = prompts.triage.system;
const TRIAGE_INSTRUCTIONS: string = prompts.triage.instructions;

export async function analyseIssue(issue: JiraIssue): Promise<AgentAnalyses> {
  const agent = Agent();
  const catalog = Catalog();

  const list = catalog.repos.map((r) => `- ${r.name}: ${r.description}`).join("\n");
  const prompt = [
    `Jira issue ${issue.key}: ${issue.summary}`,
    `Description:\n${issue.description}`,
    ``,
    `Available repositories:`,
    list,
    ``,
    TRIAGE_INSTRUCTIONS,
  ].join("\n");

  // Pure text classification — no file tools.
  const out = await agent.query(prompt, TRIAGE_SYSTEM_PROMPT, []);
  return parseAnalyses(out);
}

function parseAnalyses(raw: string): AgentAnalyses {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`agent returned no JSON classification:\n${raw}`.slice(0, 1000));
  }
  const parsed = JSON.parse(match[0]);
  const taskType: AgentAnalyses["taskType"] =
    parsed.taskType === "implementation" || parsed.taskType === "research" ? parsed.taskType : "other";

  return {
    taskType,
    repoNames: Array.isArray(parsed.repoNames) ? parsed.repoNames.map(String) : [],
    reason: String(parsed.reason ?? ""),
    userPrompt: String(parsed.userPrompt ?? ""),
  };
}
