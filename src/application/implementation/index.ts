import type { AgentAnalyses } from "../../domain/analysis.ts";
import type { Issue } from "../../domain/issue.ts";
import type { RepoOutcome } from "../../domain/outcomes.ts";
import { issueKeyToBranch } from "../../domain/conventions.ts";
import type { Deps } from "../ports.ts";
import type { PreparedRepo, SiblingDiff } from "./types.ts";
import { prepareRepos, resolveRepos } from "./prepare.ts";
import { buildPlan } from "./plan.ts";
import { implementRepo } from "./implementRepo.ts";

// Orchestrates the four phases of an implementation ticket. Each phase lives in
// its own module: prepare.ts, plan.ts, implementRepo.ts (which replicates via
// replicate.ts), and the reporting below.
export async function processImplementation(deps: Deps, issue: Issue, analyses: AgentAnalyses): Promise<void> {
  const { tracker, git, codeHost, agent, prompts, settings } = deps;
  const catalog = deps.catalog.load();
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
    const plan = await buildPlan({ agent, prompts, issue, prepared, userPrompt: analyses.userPrompt, log });

    // Phase 3 — implement each repo, feeding earlier repos' diffs forward.
    const siblingDiffs: SiblingDiff[] = [];
    for (const { repo, cwd } of prepared) {
      const outcome = await implementRepo(
        { agent, git, codeHost, prompts, settings, issue, repo, cwd, branch, plan, siblingDiffs, userPrompt: analyses.userPrompt, log },
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

    await tracker.report(issue.key, { kind: "implementation", results, assignee: issue.assignee });

    if (prs > 0) {
      try {
        await tracker.transition(issue.key, settings.reviewStatus);
      } catch (err) {
        // Best-effort — at least one PR is open, so a transition failure is non-fatal.
        log(`transition failed (non-fatal — PRs already opened) - ${err}`);
      }
    }
  } catch (err) {
    // Top-level failure (e.g. nothing could even be attempted).
    log(`ERROR: ${(err as Error).message}`);
    await tracker.report(issue.key, {
      kind: "failure",
      reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
      assignee: issue.assignee,
    });
  } finally {
    for (const { cwd } of prepared) {
      await git.cleanup(cwd);
    }
  }
}
