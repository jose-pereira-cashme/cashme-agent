import type { RepoEntry } from "../../types/domain.ts";
import type { CatalogClient, GitClient } from "../../tools/types.ts";
import type { Logger, PreparedRepo, RepoOutcome } from "../types.ts";

// Resolves the analysed repo names to catalog entries: de-duplicated, unknown
// names dropped. Falls back to the first catalog repo if nothing matched, to
// preserve the previous single-repo behaviour.
export function resolveRepos(catalog: CatalogClient, repoNames: string[]): RepoEntry[] {
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

// Phase 1 — clone + branch every target repo. A repo that fails to prepare is
// returned as a failure outcome; the others still proceed.
export async function prepareRepos(args: {
  git: GitClient;
  repos: RepoEntry[];
  issueKey: string;
  branch: string;
  log: Logger;
}): Promise<{ prepared: PreparedRepo[]; failures: RepoOutcome[] }> {
  const { git, repos, issueKey, branch, log } = args;
  const prepared: PreparedRepo[] = [];
  const failures: RepoOutcome[] = [];

  for (const repo of repos) {
    try {
      await git.ensureMirror(repo);
      const cwd = await git.makeWorkingCopy(repo, `${issueKey.toLowerCase()}-${repo.name}`);
      await git.createBranch(cwd, branch, repo.defaultBranch);
      prepared.push({ repo, cwd });
    } catch (err) {
      log(`[${repo.name}] failed to prepare: ${(err as Error).message}`);
      failures.push({
        repo: repo.name,
        reason: `erro ao preparar repositório: ${(err as Error).message}`.slice(0, 1000),
      });
    }
  }

  return { prepared, failures };
}
