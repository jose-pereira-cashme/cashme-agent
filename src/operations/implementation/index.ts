import { Jira } from "../../tools/Jira.ts";
import { Git } from "../../tools/Git.ts";
import { Github } from "../../tools/Github.ts";
import { Catalog } from "../../tools/Catalog.ts";
import type { RepoEntry } from "../../types/domain.ts";
import { Agent } from "../../agent/index.ts";
import { buildFailureComment, buildMultiRepoComment } from "../../utils/adfFormatter.ts";
import type { JiraIssue, AgentAnalyses } from "../../types/domain.ts";
import {
  IMPLEMENT_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  RETRY_NOTICE,
  buildPrBody,
  getCommitEmoji,
  issueKeyToBranch,
  parseVerifyResult,
} from "./utils.ts";
import type { RepoOutcome, PreparedRepo, SiblingDiff, VerifyResult } from "../types.ts";

const MAX_VERIFY_ATTEMPTS = Number(process.env.MAX_VERIFY_ATTEMPTS ?? 3);
const JIRA_REVIEW_STATUS = process.env.JIRA_REVIEW_STATUS ?? "Em revisão";
// Cap each sibling diff handed to a later repo's implement run, so a large
// change doesn't blow up the prompt.
const SIBLING_DIFF_LIMIT = 8000;

export async function processImplementation(issue: JiraIssue, analyses: AgentAnalyses): Promise<void> {
  const jira = Jira();
  const git = Git();
  const github = Github();
  const catalog = Catalog();
  const agent = Agent();
  const log = (msg: string) => console.log(`[implementation ${issue.key}] ${msg}`);

  const repos = resolveRepos(catalog, analyses.repoNames);
  const branch = issueKeyToBranch(issue.key, issue.issueType);
  log(`start — repos=[${repos.map((r) => r.name).join(",")}] branch=${branch} type=${issue.issueType}`);

  const prepared: PreparedRepo[] = [];
  const results: RepoOutcome[] = [];
  try {
    // Phase 1 — clone + branch every target repo. A repo that fails to prepare
    // is recorded as a failure; the others still proceed.
    for (const repo of repos) {
      try {
        await git.ensureMirror(repo);
        const cwd = await git.makeWorkingCopy(repo, `${issue.key.toLowerCase()}-${repo.name}`);
        await git.createBranch(cwd, branch, repo.defaultBranch);
        prepared.push({ repo, cwd });
      } catch (err) {
        log(`[${repo.name}] failed to prepare: ${(err as Error).message}`);
        results.push({ repo: repo.name, reason: `erro ao preparar repositório: ${(err as Error).message}`.slice(0, 1000) });
      }
    }

    // Phase 2 — one plan spanning every prepared repo.
    const plan = await buildPlan(agent, issue, prepared, analyses.userPrompt, log);

    // Phase 3 — implement each repo, feeding earlier repos' diffs forward.
    const siblingDiffs: SiblingDiff[] = [];
    for (const { repo, cwd } of prepared) {
      const outcome = await implementRepo(
        { agent, git, github, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt: analyses.userPrompt, log },
      );
      results.push(outcome);
      if (outcome.prUrl && outcome.diff) {
        siblingDiffs.push({ repo: repo.name, diff: outcome.diff });
      }
    }

    // Phase 4 — report.
    const opened = results.filter((r) => r.prUrl).length;
    log(`done — ${opened}/${results.length} repo(s) produced a PR`);

    await jira.addComment(issue.key, buildMultiRepoComment({
      results,
      reporterAccountId: issue.reporterAccountId,
      reporterName: issue.reporterDisplayName,
    }));

    if (opened > 0) {
      try {
        await jira.transitionIssue(issue.key, JIRA_REVIEW_STATUS);
      } catch {
        // Best-effort — at least one PR is open, so a transition failure is non-fatal.
        log("transition failed (non-fatal — PRs already opened)");
      }
    }
  } catch (err) {
    // Top-level failure (e.g. nothing could even be attempted).
    log(`ERROR: ${(err as Error).message}`);
    await jira.addComment(issue.key, buildFailureComment({
      reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
      reporterAccountId: issue.reporterAccountId,
      reporterName: issue.reporterDisplayName,
    }));
  } finally {
    for (const { cwd } of prepared) {
      await git.cleanup(cwd);
    }
  }
}

// Resolves the analysed repo names to catalog entries: de-duplicated, unknown
// names dropped. Falls back to the first catalog repo if nothing matched, to
// preserve the previous single-repo behaviour.
function resolveRepos(catalog: ReturnType<typeof Catalog>, repoNames: string[]): RepoEntry[] {
  const seen = new Set<string>();
  const repos: RepoEntry[] = [];
  for (const name of repoNames) {
    const repo = catalog.findRepo(name);
    if (repo && !seen.has(repo.name)) {
      seen.add(repo.name);
      repos.push(repo);
    }
  }
  if (repos.length === 0 && catalog.repos.length > 0) return [catalog.repos[0]];
  return repos;
}

// Implements one repo: runs the verify-retry loop, and on success commits,
// pushes, and opens a PR. Returns the outcome (never throws — infra errors
// become a recorded failure so sibling repos still run).
async function implementRepo(ctx: {
  agent: ReturnType<typeof Agent>;
  git: ReturnType<typeof Git>;
  github: ReturnType<typeof Github>;
  issue: JiraIssue;
  repo: RepoEntry;
  cwd: string;
  branch: string;
  plan: string;
  siblingDiffs: SiblingDiff[];
  userPrompt: string;
  log: (msg: string) => void;
}): Promise<RepoOutcome & { diff?: string }> {
  const { agent, git, github, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt, log } = ctx;
  const base = repo.defaultBranch;
  try {
    let result = await implementAndVerify(agent, issue, cwd, userPrompt, plan, siblingDiffs, null);
    log(`[${repo.name}] attempt 1: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    let attempt = 1;
    while (!result.verifyPassed && attempt < MAX_VERIFY_ATTEMPTS) {
      attempt++;
      result = await implementAndVerify(agent, issue, cwd, userPrompt, plan, siblingDiffs, result.verifyOutput);
      log(`[${repo.name}] attempt ${attempt}: verify ${result.verifyPassed ? "PASSED" : "FAILED"}`);
    }

    if (!result.verifyPassed) {
      return {
        repo: repo.name,
        reason: `verificação falhou após ${MAX_VERIFY_ATTEMPTS} tentativas:\n${result.verifyOutput}`.slice(0, 1000),
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
      title: `${issue.key}: ${issue.summary}`,
      body: buildPrBody({ issueKey: issue.key, summary: result.changeSummary }),
    });
    log(`[${repo.name}] PR ready: ${prUrl}`);
    return { repo: repo.name, summary: result.changeSummary, prUrl, diff };
  } catch (err) {
    log(`[${repo.name}] ERROR: ${(err as Error).message}`);
    return { repo: repo.name, reason: `erro na automação: ${(err as Error).message}`.slice(0, 1000) };
  }
}

// Verification installs can rewrite lockfiles even for changes that don't touch
// dependencies (e.g. an agent that installs tooling to build/run the app). If
// the agent didn't intend a dependency change — package.json is untouched —
// revert the lockfiles so the commit/PR carries only the real change.
async function discardLockfileChurn(
  git: ReturnType<typeof Git>,
  cwd: string,
  repoName: string,
  log: (msg: string) => void,
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

// Produces a read-only plan spanning every prepared repo. Best-effort: a failed
// or empty plan returns "" so implementation proceeds without one.
async function buildPlan(
  agent: ReturnType<typeof Agent>,
  issue: JiraIssue,
  prepared: PreparedRepo[],
  userPrompt: string,
  log: (msg: string) => void,
): Promise<string> {
  if (prepared.length === 0) return "";
  const repoList = prepared.map(({ repo, cwd }) => `- ${repo.name} (${cwd}): ${repo.description}`).join("\n");
  const prompt = [
    `Jira issue ${issue.key} (${issue.issueType}): ${issue.summary}`,
    `Description:\n${issue.description}`,
    issue.linkedDocs ? `Linked documentation:\n${issue.linkedDocs}` : "",
    issue.comments ? `Ticket comments (chronological):\n${issue.comments}` : "",
    `Task:\n${userPrompt}`,
    `Target repositories (read-only working copies):\n${repoList}`,
  ].filter(Boolean).join("\n\n");

  try {
    // No cwd — the plan reads across all working copies via the paths above
    // (same pattern as the research operation).
    const plan = await agent.plan({ prompt, systemPrompt: PLAN_SYSTEM_PROMPT });
    return plan.trim();
  } catch (err) {
    log(`planning failed (non-fatal): ${(err as Error).message}`);
    return "";
  }
}

async function implementAndVerify(
  agent: ReturnType<typeof Agent>,
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
