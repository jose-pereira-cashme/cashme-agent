import { Jira } from "../../tools/Jira.ts";
import { Git } from "../../tools/Git.ts";
import { Github } from "../../tools/Github.ts";
import { Catalog } from "../../tools/Catalog.ts";
import { Agent } from "../../agent/index.ts";
import { buildFailureComment, buildSuccessComment } from "../../utils/adfFormatter.ts";
import type { JiraIssue, AgentAnalyses } from "../HandleWebhook.ts";
import {
  IMPLEMENT_SYSTEM_PROMPT,
  RETRY_NOTICE,
  buildPrBody,
  getCommitEmoji,
  issueKeyToBranch,
  parseVerifyResult,
  type VerifyResult,
} from "./utils.ts";

const MAX_VERIFY_ATTEMPTS = Number(process.env.MAX_VERIFY_ATTEMPTS ?? 3);
const JIRA_REVIEW_STATUS = process.env.JIRA_REVIEW_STATUS ?? "Em revisão";

export async function processImplementation(issue: JiraIssue, analyses: AgentAnalyses): Promise<void> {
  const jira = Jira();
  const git = Git();
  const github = Github();
  const catalog = Catalog();
  const agent = Agent();

  const matched = catalog.findRepo(analyses.repoNames[0]);
  const repo = matched ?? catalog.repos[0];
  const base = repo.defaultBranch;
  const branch = issueKeyToBranch(issue.key, issue.issueType);

  let workingCopy: string | null = null;
  try {
    await git.ensureMirror(repo);
    workingCopy = await git.makeWorkingCopy(repo, issue.key.toLowerCase());
    await git.createBranch(workingCopy, branch, base);

    let result = await implementAndVerify(agent, issue, workingCopy, analyses.userPrompt, null);
    let attempt = 1;
    while (!result.verifyPassed && attempt < MAX_VERIFY_ATTEMPTS) {
      attempt++;
      result = await implementAndVerify(agent, issue, workingCopy, analyses.userPrompt, result.verifyOutput);
    }

    if (!result.verifyPassed) {
      await jira.addComment(issue.key, buildFailureComment({
        reason: `verificação falhou após ${MAX_VERIFY_ATTEMPTS} tentativas:\n${result.verifyOutput}`.slice(0, 3000),
        reporterAccountId: issue.reporterAccountId,
        reporterName: issue.reporterDisplayName,
      }));
      return;
    }

    await git.commitAll(workingCopy, `${getCommitEmoji(issue.issueType)} (${issue.key}): ${result.changeSummary}`);
    await git.push(workingCopy, branch);
    const prUrl = await github.createPr({
      cwd: workingCopy,
      base,
      head: branch,
      title: `${issue.key}: ${issue.summary}`,
      body: buildPrBody({ issueKey: issue.key, summary: result.changeSummary, guessedRepo: repo.name }),
    });

    await jira.addComment(issue.key, buildSuccessComment({
      prUrl, summary: result.changeSummary,
    }));

    try {
      await jira.transitionIssue(issue.key, JIRA_REVIEW_STATUS);
    } catch {
      // Transition is best-effort — the job already succeeded, so a failure here is non-fatal.
    }
  } catch (err) {
    await jira.addComment(issue.key, buildFailureComment({
      reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
      reporterAccountId: issue.reporterAccountId,
      reporterName: issue.reporterDisplayName,
    }));
  } finally {
    if (workingCopy) {
      await git.cleanup(workingCopy);
    }
  }
}

async function implementAndVerify(
  agent: ReturnType<typeof Agent>,
  issue: JiraIssue,
  workingCopy: string,
  userPrompt: string,
  previousOutput: string | null,
): Promise<VerifyResult> {
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    `Description:\n${issue.description}`,
    `Task:\n${userPrompt}`,
    previousOutput ? `${RETRY_NOTICE}\n${previousOutput}` : "",
  ].filter(Boolean).join("\n\n");

  const raw = await agent.implement({
    prompt,
    systemPrompt: IMPLEMENT_SYSTEM_PROMPT,
    cwd: workingCopy,
  });

  return parseVerifyResult(raw);
}
