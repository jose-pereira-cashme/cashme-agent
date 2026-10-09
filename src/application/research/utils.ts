import { parseAgentJson } from "../agentOutput.ts";

export const RESEARCH_TOOLS = ["Read", "Grep", "Glob", "Bash", "WebSearch", "WebFetch"];

export function parseFindings(raw: string): string {
  const parsed = parseAgentJson(raw);
  if (!parsed) return raw.trim();
  return String(parsed.findings ?? raw).trim();
}
