import { parseAgentJson } from "../agentOutput.ts";
import type { VerifyResult } from "./types.ts";

export function parseVerifyResult(raw: string): VerifyResult {
  const parsed = parseAgentJson(raw);
  if (!parsed) {
    return { verifyPassed: false, verifyOutput: `agent returned no JSON result:\n${raw}`.slice(0, 3000), changeSummary: "", commitMessage: "" };
  }
  return {
    verifyPassed: parsed.verifyPassed === true,
    verifyOutput: String(parsed.verifyOutput ?? ""),
    changeSummary: String(parsed.changeSummary ?? ""),
    commitMessage: String(parsed.commitMessage ?? ""),
  };
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
