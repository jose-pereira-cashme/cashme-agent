import { Jira } from "../../tools/Jira.ts";
import { Git } from "../../tools/Git.ts";
import { Github } from "../../tools/Github.ts";
import { Catalog } from "../../tools/Catalog.ts";
import { Agent } from "../../agent/index.ts";
import { buildFailureComment, buildMultiRepoComment } from "../../utils/adfFormatter.ts";
import type { JiraIssue, AgentAnalyses } from "../../types/domain.ts";
import type { PreparedRepo, RepoOutcome, SiblingDiff } from "../types.ts";
import { issueKeyToBranch } from "./utils.ts";
import { prepareRepos, resolveRepos } from "./prepare.ts";
import { buildPlan } from "./plan.ts";
import { implementRepo } from "./implementRepo.ts";
import { config } from "../../config.ts";

// Orchestrates the four phases of an implementation ticket. Each phase lives in
// its own module: prepare.ts, plan.ts, implementRepo.ts (which replicates via
// replicate.ts), and the reporting below.
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

  // Declared outside the try so the finally block can always clean up whatever
  // working copies were created.
  const prepared: PreparedRepo[] = [];
  const results: RepoOutcome[] = [];
  try {
    // Phase 1 — mirror, working copy and branch per repo.
    const { prepared: ok, failures } = await prepareRepos({ git, repos, issueKey: issue.key, branch, log });
    prepared.push(...ok);
    results.push(...failures);

    // Phase 2 — one plan spanning every prepared repo.
    const plan = await buildPlan({ agent, issue, prepared, userPrompt: analyses.userPrompt, log });

    // Phase 3 — implement each repo, feeding earlier repos' diffs forward.
    const siblingDiffs: SiblingDiff[] = [];
    for (const { repo, cwd } of prepared) {
      const outcome = await implementRepo(
        { agent, git, github, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt: analyses.userPrompt, log },
      );
      results.push(outcome);
      if (outcome.branch && outcome.diff) {
        siblingDiffs.push({ repo: repo.name, diff: outcome.diff });
      }
    }

    // Phase 4 — report.
    const succeeded = results.filter((r) => r.branch).length;
    const prs = results.reduce((n, r) => n + (r.replicas?.filter((x) => x.prUrl).length ?? 0), 0);
    log(`done — ${succeeded}/${results.length} repo(s) implemented, ${prs} PR(s) opened`);

    await jira.addComment(issue.key, buildMultiRepoComment({
      results,
      reporterAccountId: issue.reporterAccountId,
      reporterName: issue.reporterDisplayName,
    }));

    if (prs > 0) {
      try {
        await jira.transitionIssue(issue.key, config.jiraReviewStatus);
      } catch (err) {
        // Best-effort — at least one PR is open, so a transition failure is non-fatal.
        log(`transition failed (non-fatal — PRs already opened) - ${err}`);
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
