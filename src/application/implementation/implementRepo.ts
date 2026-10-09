import type { Issue } from "../../domain/issue.ts";
import type { RepoEntry } from "../../domain/repo.ts";
import type { RepoOutcome } from "../../domain/outcomes.ts";
import { getCommitEmoji } from "../../domain/conventions.ts";
import type { AgentClient, CodeHost, GitClient, Logger, Prompts, Settings } from "../ports.ts";
import type { SiblingDiff, VerifyResult } from "./types.ts";
import { parseVerifyResult } from "./utils.ts";
import { replicateToBases } from "./replicate.ts";
import { issueContextBlocks } from "../promptBlocks.ts";

const SIBLING_DIFF_LIMIT = 8000;

// Phase 3 — implements one repo: runs the verify-retry loop, and on success
// commits, pushes, opens a PR and replicates the commit onto the extra bases.
// Returns the outcome (never throws — infra errors become a recorded failure so
// sibling repos still run).
export async function implementRepo(ctx: {
  agent: AgentClient;
  git: GitClient;
  codeHost: CodeHost;
  prompts: Prompts;
  settings: Settings;
  issue: Issue;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  plan: string;
  siblingDiffs: SiblingDiff[];
  userPrompt: string;
  log: Logger;
}): Promise<RepoOutcome & { diff?: string }> {
  const { agent, git, codeHost, prompts, settings, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt, log } = ctx;
  const base = repo.defaultBranch;
  try {
    let result = await implementAndVerify(agent, prompts, issue, cwd, userPrompt, plan, siblingDiffs, null);
    log(`[${repo.name}] attempt 1: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    let attempt = 1;
    while (!result.verifyPassed && attempt < settings.maxVerifyAttempts) {
      attempt++;
      result = await implementAndVerify(agent, prompts, issue, cwd, userPrompt, plan, siblingDiffs, result.verifyOutput);
      log(`[${repo.name}] attempt ${attempt}: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    }

    if (!result.verifyPassed) {
      return {
        repo: repo.name,
        reason: `verificação falhou após ${settings.maxVerifyAttempts} tentativas:\n${result.verifyOutput}`.slice(0, 1000),
      };
    }

    await discardLockfileChurn(git, cwd, repo.name, log);
    // The commit is in English; the Portuguese summary is kept for Jira and the
    // PR body, and only stands in when the agent left the English one out.
    const commitSubject = result.commitMessage.trim() || result.changeSummary;
    await git.commitAll(cwd, `${getCommitEmoji(issue.issueType)} (${issue.key}): ${commitSubject}`);
    let diff = "";
    try {
      diff = (await git.diff(cwd, base)).trim();
    } catch (err) {
      log(`[${repo.name}] could not capture diff (non-fatal): ${(err as Error).message}`);
    }

    // The work branch is pushed but gets no PR of its own — the default branch is
    // not a merge target. It is the source the replicas are cherry-picked from.
    await git.push(cwd, branch);
    log(`[${repo.name}] work branch pushed: ${branch} (no PR against ${base})`);

    const replicas = await replicateToBases({
      agent, git, codeHost, prompts, settings, repo, cwd, branch, issue, summary: result.changeSummary, log,
    });
    return { repo: repo.name, summary: result.changeSummary, branch, replicas, diff };
  } catch (err) {
    log(`[${repo.name}] ERROR: ${(err as Error).message}`);
    return { repo: repo.name, reason: `erro na automação: ${(err as Error).message}`.slice(0, 1000) };
  }
}

async function implementAndVerify(
  agent: AgentClient,
  prompts: Prompts,
  issue: Issue,
  workingCopy: string,
  userPrompt: string,
  plan: string,
  siblingDiffs: SiblingDiff[],
  previousOutput: string | null,
): Promise<VerifyResult> {
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    ...issueContextBlocks(issue),
    `Task:\n${userPrompt}`,
    plan ? `Implementation plan (follow it unless you find it wrong):\n${plan}` : "",
    formatSiblingDiffs(siblingDiffs),
    previousOutput ? `${prompts.implementation.retryNotice}\n${previousOutput}` : "",
  ].filter(Boolean).join("\n\n");

  const raw = await agent.run({
    prompt,
    systemPrompt: prompts.implementation.system,
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
