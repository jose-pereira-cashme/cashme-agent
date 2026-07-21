import { readPrompt } from "../../utils/prompts.ts";
import { parseAgentJson } from "../../utils/parseAgentJson.ts";

export const RESEARCH_SYSTEM_PROMPT: string = readPrompt("research", "system");
export const RESEARCH_INSTRUCTIONS: string = readPrompt("research", "instructions");

// Read-only toolset — the agent investigates the cloned repos without editing them,
// plus web search/fetch for looking things up beyond the codebase.
export const RESEARCH_TOOLS = ["Read", "Grep", "Glob", "Bash", "WebSearch", "WebFetch"];

export function parseFindings(raw: string): string {
  const parsed = parseAgentJson(raw);
  if (!parsed) return raw.trim();
  return String(parsed.findings ?? raw).trim();
}
