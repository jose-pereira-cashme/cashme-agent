import { readPrompt } from "../../utils/prompts.ts";
import type { VerifyResult } from "../types.ts";

export const IMPLEMENT_SYSTEM_PROMPT: string = readPrompt("implementation", "system");
export const PLAN_SYSTEM_PROMPT: string = readPrompt("implementation", "plan");
export const RETRY_NOTICE: string = readPrompt("implementation", "retryNotice");

export function parseVerifyResult(raw: string): VerifyResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { verifyPassed: false, verifyOutput: `agent returned no JSON result:\n${raw}`.slice(0, 3000), changeSummary: "" };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      verifyPassed: parsed.verifyPassed === true,
      verifyOutput: String(parsed.verifyOutput ?? ""),
      changeSummary: String(parsed.changeSummary ?? ""),
    };
  } catch {
    return { verifyPassed: false, verifyOutput: `could not parse agent result:\n${raw}`.slice(0, 3000), changeSummary: "" };
  }
}

export function issueKeyToBranch(key: string, issueType: string): string {
  const prefix = issueType.toLowerCase() === "bug" ? "bugfix" : "feature";
  return `${prefix}/${key.toLowerCase()}`;
}

export function getCommitEmoji(issueType: string): string {
  return issueType.toLowerCase() === "bug" ? "🐛" : "✨";
}

export function buildPrBody(args: {
  issueKey: string; summary: string;
}): string {
  const lines = [
    `## ${args.issueKey}`,
    "",
    args.summary,
    "",
    "---",
    "_Pull request aberto automaticamente pela automação cashme-agent._",
  ];

  return lines.join("\n");
}
