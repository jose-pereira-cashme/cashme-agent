import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Jira } from "../../tools/Jira.ts";
import { extractDocxText } from "../../utils/docx.ts";
import {
  MAX_ATTACHMENT_BYTES,
  attachmentFilename,
  classifyAttachment,
  clipDocText,
} from "../../utils/attachmentKinds.ts";
import { config } from "../../config.ts";
import type { JiraIssue } from "../../types/domain.ts";

export type CollectedAttachments = {
  docText: string;
  imagePaths: string[];
};

function attachmentsDirFor(issueKey: string): string {
  return join(config.attachmentsDir, issueKey.toLowerCase());
}

export async function collectAttachments(issue: JiraIssue): Promise<CollectedAttachments> {
  const log = (msg: string) => console.log(`[attachments ${issue.key}] ${msg}`);
  const attachments = issue.attachments;
  if (attachments.length === 0) return { docText: "", imagePaths: [] };

  const jira = Jira();
  const dir = attachmentsDirFor(issue.key);
  const blocks: string[] = [];
  const imagePaths: string[] = [];
  let dirCreated = false;

  for (const attachment of attachments) {
    const kind = classifyAttachment(attachment);
    if (kind === "skip") {
      log(`skipping "${attachment.filename}" (${attachment.mimeType || "unknown type"}) — unsupported`);
      continue;
    }
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      log(`skipping "${attachment.filename}" — ${attachment.size} bytes exceeds the limit`);
      continue;
    }

    try {
      const buffer = await jira.downloadAttachment(attachment.id);

      if (kind === "image") {
        if (!dirCreated) {
          await mkdir(dir, { recursive: true });
          dirCreated = true;
        }
        const path = join(dir, attachmentFilename(attachment));
        await writeFile(path, buffer);
        imagePaths.push(path);
        log(`image saved: ${attachment.filename} -> ${path}`);
        continue;
      }

      const text = kind === "docx" ? extractDocxText(buffer) : buffer.toString("utf8").trim();
      if (!text) {
        log(`"${attachment.filename}" produced no text — skipping`);
        continue;
      }
      blocks.push(`### Anexo do ticket: ${attachment.filename}\n${clipDocText(text)}`);
      log(`text extracted: ${attachment.filename} (${text.length} chars)`);
    } catch (err) {
      log(`failed to read "${attachment.filename}" (skipping): ${(err as Error).message}`);
    }
  }

  return { docText: blocks.join("\n\n"), imagePaths };
}

export async function cleanupAttachments(issueKey: string): Promise<void> {
  await rm(attachmentsDirFor(issueKey), { recursive: true, force: true }).catch(() => {});
}
