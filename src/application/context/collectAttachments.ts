import {
  MAX_ATTACHMENT_BYTES,
  classifyAttachment,
  clipDocText,
} from "../../domain/attachments.ts";
import type { Issue } from "../../domain/issue.ts";
import type { Deps } from "../ports.ts";

export type CollectedAttachments = {
  docText: string;
  imagePaths: string[];
};

export async function collectAttachments(
  deps: Pick<Deps, "tracker" | "attachments" | "parser">,
  issue: Issue,
): Promise<CollectedAttachments> {
  const log = (msg: string) => console.log(`[attachments ${issue.key}] ${msg}`);
  const attachments = issue.attachments;
  if (attachments.length === 0) return { docText: "", imagePaths: [] };

  const blocks: string[] = [];
  const imagePaths: string[] = [];

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
      const buffer = await deps.tracker.downloadAttachment(attachment.id);

      if (kind === "image") {
        const path = await deps.attachments.saveImage(issue.key, attachment, buffer);
        imagePaths.push(path);
        log(`image saved: ${attachment.filename} -> ${path}`);
        continue;
      }

      const text = kind === "docx" ? deps.parser.docxToText(buffer) : buffer.toString("utf8").trim();
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
