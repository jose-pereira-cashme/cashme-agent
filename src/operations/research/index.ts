import { Jira } from "../../tools/Jira.ts";
import { Git } from "../../tools/Git.ts";
import { Catalog } from "../../tools/Catalog.ts";
import type { RepoEntry } from "../../types/domain.ts";
import { Agent } from "../../agent/index.ts";
import { buildFailureComment, buildResearchComment } from "../../utils/adfFormatter.ts";
import type { JiraIssue, AgentAnalyses } from "../../types/domain.ts";
import {
  RESEARCH_SYSTEM_PROMPT,
  RESEARCH_INSTRUCTIONS,
  RESEARCH_TOOLS,
  parseFindings,
} from "./utils.ts";

export async function processResearch(issue: JiraIssue, analyses: AgentAnalyses): Promise<void> {
  const jira = Jira();
  const git = Git();
  const catalog = Catalog();
  const agent = Agent();
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

    const findings = await research(agent, issue, repoPaths, analyses.userPrompt);
    await jira.addComment(issue.key, buildResearchComment({findings, reporterAccountId: issue.reporterAccountId, reporterName: issue.reporterDisplayName}));
    log("SUCCESS — research done");
  } catch (err) {
    log(`ERROR: ${(err as Error).message}`);
    await jira.addComment(issue.key, buildFailureComment({
      reason: `erro na automação (research): ${(err as Error).message}`.slice(0, 3000),
      reporterAccountId: issue.reporterAccountId,
      reporterName: issue.reporterDisplayName,
    }));
  } finally {
    for (const path of repoPaths) {
      await git.cleanup(path);
    }
  }
}

async function research(
  agent: ReturnType<typeof Agent>,
  issue: JiraIssue,
  repoPaths: string[],
  userPrompt: string,
): Promise<string> {
  const repoList = repoPaths.length > 0
    ? `You have Read/Grep/Bash access to these repositories (read-only):\n${repoPaths.map((p) => `- ${p}`).join("\n")}`
    : "No specific repositories are available — answer from general knowledge or note what's needed.";

  const prompt = [
    `Research task for Jira issue ${issue.key}: ${issue.summary}`,
    `Description:\n${issue.description}`,
    issue.linkedDocs ? `Linked documentation:\n${issue.linkedDocs}` : "",
    issue.comments ? `Ticket comments (chronological):\n${issue.comments}` : "",
    userPrompt ? `User request: ${userPrompt}` : "",
    repoList,
    RESEARCH_INSTRUCTIONS,
  ].filter(Boolean).join("\n\n");

  const raw = await agent.run({
    prompt,
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
    allowedTools: RESEARCH_TOOLS,
  });

  return parseFindings(raw);
}
