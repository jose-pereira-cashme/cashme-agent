import { Jira } from "../tools/Jira.ts";
import { buildFailureComment } from "../utils/adfFormatter.ts";
import { analyseIssue } from "./analyseIssue/index.ts";
import { processImplementation } from "./implementation/index.ts";
import { processResearch } from "./research/index.ts";

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  reporterAccountId: string | null;
  reporterDisplayName: string | null;
}

export interface AgentAnalyses {
  taskType: "implementation" | "research" | "other";
  repoNames: string[];
  reason: string;
  userPrompt: string;
}

export async function handleWebhook(issueKey: string) {
    const JiraClient = Jira()

    let issue: JiraIssue
    try{
        issue = await JiraClient.getIssue(issueKey)
    }catch(err) {
        await JiraClient.addComment(issueKey, buildFailureComment({
            reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
            reporterAccountId: null,
            reporterName: null,
        }));
        return
    }

    let analyses: AgentAnalyses;
    try {
        analyses = await analyseIssue(issue);
    } catch (err) {
        await JiraClient.addComment(issue.key, buildFailureComment({
            reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
            reporterAccountId: issue.reporterAccountId,
            reporterName: issue.reporterDisplayName,
        }));
        return;
    }

    if (analyses.taskType === "implementation") {
        await processImplementation(issue, analyses);
    } else if (analyses.taskType === "research") {
        await processResearch(issue, analyses);
    }
}
