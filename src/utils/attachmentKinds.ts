import type { JiraAttachment } from "../types/domain.ts";

// Anything larger is almost certainly a video or an archive, not a spec.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Keep one extracted document from crowding the whole prompt.
export const DOC_TEXT_LIMIT = 40_000;

const IMAGE_MIME = /^image\/(png|jpeg|jpg|gif|webp)$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_EXTENSION = /\.(txt|md|markdown|csv|json)$/i;
const IMAGE_EXTENSION_BY_MIME: Record<string, string | undefined> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export type AttachmentKind = "image" | "docx" | "text" | "skip";

export function classifyAttachment(attachment: JiraAttachment): AttachmentKind {
  const { mimeType, filename } = attachment;
  if (IMAGE_MIME.test(mimeType)) return "image";
  if (mimeType === DOCX_MIME || filename.toLowerCase().endsWith(".docx")) return "docx";
  if (mimeType.startsWith("text/") || TEXT_EXTENSION.test(filename)) return "text";
  return "skip";
}

// The extension has to survive: the Read tool decides an image is an image by
// looking at it. The id prefix keeps same-named attachments from colliding.
export function attachmentFilename(attachment: JiraAttachment): string {
  const cleaned = attachment.filename.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "");
  const hasExtension = /\.[A-Za-z0-9]+$/.test(cleaned);
  const extension = hasExtension ? "" : (IMAGE_EXTENSION_BY_MIME[attachment.mimeType.toLowerCase()] ?? ".png");
  return `${attachment.id}-${cleaned || "anexo"}${extension}`;
}

export function clipDocText(text: string): string {
  return text.length > DOC_TEXT_LIMIT
    ? `${text.slice(0, DOC_TEXT_LIMIT)}\n… (documento truncado)`
    : text;
}
