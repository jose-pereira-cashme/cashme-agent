import { readPrompt } from "../../utils/prompts.ts";
import { parseAgentJson } from "../../utils/parseAgentJson.ts";
import type { VerifyResult } from "../types.ts";

export const IMPLEMENT_SYSTEM_PROMPT: string = readPrompt("implementation", "system");
export const PLAN_SYSTEM_PROMPT: string = readPrompt("implementation", "plan");
export const RETRY_NOTICE: string = readPrompt("implementation", "retryNotice");

export function parseVerifyResult(raw: string): VerifyResult {
  const parsed = parseAgentJson(raw);
  if (!parsed) {
    return { verifyPassed: false, verifyOutput: `agent returned no JSON result:\n${raw}`.slice(0, 3000), changeSummary: "" };
  }
  return {
    verifyPassed: parsed.verifyPassed === true,
    verifyOutput: String(parsed.verifyOutput ?? ""),
    changeSummary: String(parsed.changeSummary ?? ""),
  };
}

export function issueKeyToBranch(key: string, issueType: string): string {
  const prefix = issueType.toLowerCase() === "bug" ? "bugfix" : "feature";
  return `${prefix}/${key.toLowerCase()}`;
}

export function getCommitEmoji(issueType: string): string {
  return issueType.toLowerCase() === "bug" ? "🐛" : "✨";
}

export function buildPrBody(args: {
  issueKey: string; summary: string; base: string; sourceBranch: string;
}): string {
  const lines = [
    `## ${args.issueKey}`,
    "",
    args.summary,
    "",
    `Base: \`${args.base}\` — mesmos commits da branch \`${args.sourceBranch}\`.`,
    "",
    "---",
    "_Pull request aberto automaticamente pela automação cashme-agent._",
  ];

  return lines.join("\n");
}
