import { collectLinkedDocs } from "./collectLinkedDocs.ts";
import { collectAttachments, cleanupAttachments } from "./collectAttachments.ts";
import type { JiraIssue } from "../../types/domain.ts";

export async function collectIssueContext(issue: JiraIssue): Promise<void> {
  const linkedDocs = await collectLinkedDocs(issue);
  const attachments = await collectAttachments(issue);

  issue.referenceImages = attachments.imagePaths;
  issue.linkedDocs = [linkedDocs, attachments.docText].filter(Boolean).join("\n\n");
  console.log(
    `[context ${issue.key}] ${issue.linkedDocs.length} chars of docs, ${attachments.imagePaths.length} reference image(s)`,
  );
}

export async function releaseIssueContext(issueKey: string): Promise<void> {
  await cleanupAttachments(issueKey);
}
