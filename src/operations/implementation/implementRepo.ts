import type { AgentClient } from "../../agent/types.ts";
import type { GitClient, GithubClient } from "../../tools/types.ts";
import type { JiraIssue, RepoEntry } from "../../types/domain.ts";
import type { Logger, RepoOutcome, SiblingDiff, VerifyResult } from "../types.ts";
import { config } from "../../config.ts";
import {
  IMPLEMENT_SYSTEM_PROMPT,
  RETRY_NOTICE,
  buildPrBody,
  getCommitEmoji,
  parseVerifyResult,
} from "./utils.ts";
import { replicateToBases } from "./replicate.ts";

// Cap each sibling diff handed to a later repo's implement run, so a large
// change doesn't blow up the prompt.
const SIBLING_DIFF_LIMIT = 8000;

// Phase 3 — implements one repo: runs the verify-retry loop, and on success
// commits, pushes, opens a PR and replicates the commit onto the extra bases.
// Returns the outcome (never throws — infra errors become a recorded failure so
// sibling repos still run).
export async function implementRepo(ctx: {
  agent: AgentClient;
  git: GitClient;
  github: GithubClient;
  issue: JiraIssue;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  plan: string;
  siblingDiffs: SiblingDiff[];
  userPrompt: string;
  log: Logger;
}): Promise<RepoOutcome & { diff?: string }> {
  const { agent, git, github, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt, log } = ctx;
  const base = repo.defaultBranch;
  try {
    let result = await implementAndVerify(agent, issue, cwd, userPrompt, plan, siblingDiffs, null);
    log(`[${repo.name}] attempt 1: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    let attempt = 1;
    while (!result.verifyPassed && attempt < config.maxVerifyAttempts) {
      attempt++;
      result = await implementAndVerify(agent, issue, cwd, userPrompt, plan, siblingDiffs, result.verifyOutput);
      log(`[${repo.name}] attempt ${attempt}: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    }

    if (!result.verifyPassed) {
      return {
        repo: repo.name,
        reason: `verificação falhou após ${config.maxVerifyAttempts} tentativas:\n${result.verifyOutput}`.slice(0, 1000),
      };
    }

    await discardLockfileChurn(git, cwd, repo.name, log);
    await git.commitAll(cwd, `${getCommitEmoji(issue.issueType)} (${issue.key}): ${result.changeSummary}`);
    let diff = "";
    try {
      diff = (await git.diff(cwd, base)).trim();
    } catch (err) {
      log(`[${repo.name}] could not capture diff (non-fatal): ${(err as Error).message}`);
    }

    await git.push(cwd, branch);
    const prUrl = await github.createPr({
      cwd,
      base,
      head: branch,
      title: `${branch} - Cashme Agent(IA)`,
      body: buildPrBody({ issueKey: issue.key, summary: result.changeSummary, base }),
    });
    log(`[${repo.name}] PR ready: ${prUrl}`);

    // The work happened on top of the default branch; the same commits are copied
    // onto the other bases so each environment gets its own branch and PR.
    const replicas = await replicateToBases({
      git, github, repo, cwd, branch, issue, summary: result.changeSummary, log,
    });
    return { repo: repo.name, summary: result.changeSummary, prUrl, replicas, diff };
  } catch (err) {
    log(`[${repo.name}] ERROR: ${(err as Error).message}`);
    return { repo: repo.name, reason: `erro na automação: ${(err as Error).message}`.slice(0, 1000) };
  }
}

async function implementAndVerify(
  agent: AgentClient,
  issue: JiraIssue,
  workingCopy: string,
  userPrompt: string,
  plan: string,
  siblingDiffs: SiblingDiff[],
  previousOutput: string | null,
): Promise<VerifyResult> {
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    `Description:\n${issue.description}`,
    issue.linkedDocs ? `Linked documentation:\n${issue.linkedDocs}` : "",
    issue.comments ? `Ticket comments (chronological):\n${issue.comments}` : "",
    `Task:\n${userPrompt}`,
    plan ? `Implementation plan (follow it unless you find it wrong):\n${plan}` : "",
    formatSiblingDiffs(siblingDiffs),
    previousOutput ? `${RETRY_NOTICE}\n${previousOutput}` : "",
  ].filter(Boolean).join("\n\n");

  const raw = await agent.run({
    prompt,
    systemPrompt: IMPLEMENT_SYSTEM_PROMPT,
    cwd: workingCopy,
  });

  return parseVerifyResult(raw);
}

function formatSiblingDiffs(siblingDiffs: SiblingDiff[]): string {
  if (siblingDiffs.length === 0) return "";
  const blocks = siblingDiffs.map(({ repo, diff }) => {
    const body = diff.length > SIBLING_DIFF_LIMIT
      ? `${diff.slice(0, SIBLING_DIFF_LIMIT)}\n… (diff truncated)`
      : diff;
    return `--- ${repo} ---\n${body}`;
  });
  return [
    "Changes already applied to sibling repositories this run. Where the plan says this repo replicates a sibling, make the equivalent change (adapting it to this repo's structure):",
    ...blocks,
  ].join("\n\n");
}

// Verification installs can rewrite lockfiles even for changes that don't touch
// dependencies (e.g. an agent that installs tooling to build/run the app). If
// the agent didn't intend a dependency change — package.json is untouched —
// revert the lockfiles so the commit/PR carries only the real change.
async function discardLockfileChurn(
  git: GitClient,
  cwd: string,
  repoName: string,
  log: Logger,
): Promise<void> {
  const LOCKFILE = /(^|\/)(yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$/;
  try {
    const changed = await git.status(cwd);
    if (changed.some((c) => /(^|\/)package\.json$/.test(c.path))) return; // intentional dep change — keep lockfiles
    const locks = changed.filter((c) => LOCKFILE.test(c.path));
    for (const lock of locks) await git.restoreFile(cwd, lock.path, lock.untracked);
    if (locks.length > 0) {
      log(`[${repoName}] discarded lockfile churn (no package.json change): ${locks.map((l) => l.path).join(", ")}`);
    }
  } catch (err) {
    log(`[${repoName}] lockfile guard skipped (non-fatal): ${(err as Error).message}`);
  }
}
