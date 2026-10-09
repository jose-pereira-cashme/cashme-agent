import type { AgentAnalyses } from "../../domain/analysis.ts";
import type { Issue } from "../../domain/issue.ts";
import type { RepoEntry } from "../../domain/repo.ts";
import type { AgentClient, Deps, Prompts } from "../ports.ts";
import { issueContextBlocks } from "../promptBlocks.ts";
import {
  RESEARCH_TOOLS,
  parseFindings,
} from "./utils.ts";

export async function processResearch(deps: Deps, issue: Issue, analyses: AgentAnalyses): Promise<void> {
  const { tracker, git, agent, prompts } = deps;
  const catalog = deps.catalog.load();
  const log = (msg: string) => console.log(`[research ${issue.key}] ${msg}`);

  const repos = analyses.repoNames
    .map((name) => catalog.findRepo(name))
    .filter((repo): repo is RepoEntry => repo !== null);
  log(`start — repos=[${repos.map((r) => r.name).join(",")}]`);

  const repoPaths: string[] = [];
  try {
    // Clone each repo read-only (no branch — just for searching).
    for (const repo of repos) {
      await git.ensureMirror(repo);
      const path = await git.makeWorkingCopy(repo, `${issue.key.toLowerCase()}-research-${repo.name}`);
      repoPaths.push(path);
    }

    const findings = await research(agent, prompts, issue, repoPaths, analyses.userPrompt);
    await tracker.report(issue.key, { kind: "research", findings, assignee: issue.assignee });
    log("SUCCESS — research done");
  } catch (err) {
    log(`ERROR: ${(err as Error).message}`);
    await tracker.report(issue.key, {
      kind: "failure",
      reason: `erro na automação (research): ${(err as Error).message}`.slice(0, 3000),
      assignee: issue.assignee,
    });
  } finally {
    for (const path of repoPaths) {
      await git.cleanup(path);
    }
  }
}

async function research(
  agent: AgentClient,
  prompts: Prompts,
  issue: Issue,
  repoPaths: string[],
  userPrompt: string,
): Promise<string> {
  const repoList = repoPaths.length > 0
    ? `You have Read/Grep/Bash access to these repositories (read-only):\n${repoPaths.map((p) => `- ${p}`).join("\n")}`
    : "No specific repositories are available — answer from general knowledge or note what's needed.";

  const prompt = [
    `Research task for Jira issue ${issue.key}: ${issue.summary}`,
    ...issueContextBlocks(issue),
    userPrompt ? `User request: ${userPrompt}` : "",
    repoList,
    prompts.research.instructions,
  ].filter(Boolean).join("\n\n");

  const raw = await agent.run({
    prompt,
    systemPrompt: prompts.research.system,
    allowedTools: RESEARCH_TOOLS,
  });

  return parseFindings(raw);
}
