import { collectLinkedDocs } from "./collectLinkedDocs.ts";
import { collectAttachments } from "./collectAttachments.ts";
import type { Issue } from "../../domain/issue.ts";
import type { Deps } from "../ports.ts";

export async function collectIssueContext(deps: Deps, issue: Issue): Promise<Issue> {
  const linkedDocs = await collectLinkedDocs(deps, issue);
  const attachments = await collectAttachments(deps, issue);

  const docs = [linkedDocs, attachments.docText].filter(Boolean).join("\n\n");
  console.log(
    `[context ${issue.key}] ${docs.length} chars of docs, ${attachments.imagePaths.length} reference image(s)`,
  );
  return { ...issue, referenceImages: attachments.imagePaths, linkedDocs: docs };
}

export async function releaseIssueContext(deps: Deps, issueKey: string): Promise<void> {
  await deps.attachments.release(issueKey);
}
