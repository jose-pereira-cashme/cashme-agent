import type { Attachment } from "./issue.ts";

// Anything larger is almost certainly a video or an archive, not a spec.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Keep one extracted document from crowding the whole prompt.
export const DOC_TEXT_LIMIT = 40_000;

const IMAGE_MIME = /^image\/(png|jpeg|jpg|gif|webp)$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_EXTENSION = /\.(txt|md|markdown|csv|json)$/i;

export type AttachmentKind = "image" | "docx" | "text" | "skip";

export function classifyAttachment(attachment: Attachment): AttachmentKind {
  const { mimeType, filename } = attachment;
  if (IMAGE_MIME.test(mimeType)) return "image";
  if (mimeType === DOCX_MIME || filename.toLowerCase().endsWith(".docx")) return "docx";
  if (mimeType.startsWith("text/") || TEXT_EXTENSION.test(filename)) return "text";
  return "skip";
}

export function clipDocText(text: string): string {
  return text.length > DOC_TEXT_LIMIT
    ? `${text.slice(0, DOC_TEXT_LIMIT)}\n… (documento truncado)`
    : text;
}
