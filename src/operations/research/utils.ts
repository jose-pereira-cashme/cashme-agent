import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_PATH = process.env.PROMPTS_PATH ?? join(process.cwd(), "prompts.json");
const prompts = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));

export const RESEARCH_SYSTEM_PROMPT: string = prompts.research.system;
export const RESEARCH_INSTRUCTIONS: string = prompts.research.instructions;

// Read-only toolset — the agent investigates the cloned repos without editing them,
// plus web search/fetch for looking things up beyond the codebase.
export const RESEARCH_TOOLS = ["Read", "Grep", "Glob", "Bash", "WebSearch", "WebFetch"];

export function parseFindings(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return raw.trim();
  try {
    const parsed = JSON.parse(match[0]);
    return String(parsed.findings ?? raw).trim();
  } catch {
    return raw.trim();
  }
}
