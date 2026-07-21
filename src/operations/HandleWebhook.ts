import { Jira } from "../tools/Jira.ts";
import { buildFailureComment } from "../utils/adfFormatter.ts";
import { collectLinkedDocs } from "./collectLinkedDocs.ts";
import { analyseIssue } from "./analyseIssue/index.ts";
import { processImplementation } from "./implementation/index.ts";
import { processResearch } from "./research/index.ts";
import type { JiraIssue, AgentAnalyses } from "../types/domain.ts";

export async function handleWebhook(issueKey: string) {
    const log = (msg: string) => console.log(`[webhook ${issueKey}] ${msg}`);
    const JiraClient = Jira()

    let issue: JiraIssue
    try{
        issue = await JiraClient.getIssue(issueKey)
        log(`issue fetched — "${issue.summary}" (${issue.issueType})`);
        issue.linkedDocs = await collectLinkedDocs(issue);
    }catch(err) {
        log(`ERROR fetching issue: ${(err as Error).message}`);
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
        log(`ERROR analysing issue: ${(err as Error).message}`);
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
    } else {
        log(`taskType="${analyses.taskType}" — nothing to do`);
    }
}
