import { collectIssueContext, releaseIssueContext } from "./context/index.ts";
import { analyseIssue } from "./triage/index.ts";
import { processImplementation } from "./implementation/index.ts";
import { processResearch } from "./research/index.ts";
import type { AgentAnalyses } from "../domain/analysis.ts";
import type { Issue } from "../domain/issue.ts";
import type { Deps } from "./ports.ts";

export function createHandleAgentRequest(deps: Deps): (issueKey: string) => Promise<void> {
  return (issueKey) => handleAgentRequest(deps, issueKey);
}

async function handleAgentRequest(deps: Deps, issueKey: string) {
    const log = (msg: string) => console.log(`[agent ${issueKey}] ${msg}`);
    const { tracker } = deps;

    try {
        let issue: Issue
        try{
            issue = await tracker.getIssue(issueKey)
            log(`issue fetched — "${issue.summary}" (${issue.issueType})`);
            issue = await collectIssueContext(deps, issue);
        }catch(err) {
            log(`ERROR fetching issue: ${(err as Error).message}`);
            await tracker.report(issueKey, {
                kind: "failure",
                reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
                assignee: null,
            });
            return
        }

        let analyses: AgentAnalyses;
        try {
            analyses = await analyseIssue(deps, issue);
        } catch (err) {
            log(`ERROR analysing issue: ${(err as Error).message}`);
            await tracker.report(issue.key, {
                kind: "failure",
                reason: `erro na automação: ${(err as Error).message}`.slice(0, 3000),
                assignee: issue.assignee,
            });
            return;
        }

        if (analyses.taskType === "implementation") {
            await processImplementation(deps, issue, analyses);
        } else if (analyses.taskType === "research") {
            await processResearch(deps, issue, analyses);
        } else {
            log(`taskType="${analyses.taskType}" — asking assignee for more detail`);
            await tracker.report(issue.key, {
                kind: "needsInfo",
                triageReason: analyses.reason.slice(0, 1000),
                assignee: issue.assignee,
            });
        }
    } finally {
        await releaseIssueContext(deps, issueKey);
    }
}
