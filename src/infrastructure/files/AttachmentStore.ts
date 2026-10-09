import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AttachmentStore } from "../../application/ports.ts";
import type { Attachment } from "../../domain/issue.ts";

const IMAGE_EXTENSION_BY_MIME: Record<string, string | undefined> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// The extension has to survive: the Read tool decides an image is an image by
// looking at it. The id prefix keeps same-named attachments from colliding.
function attachmentFilename(attachment: Attachment): string {
  const cleaned = attachment.filename.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "");
  const hasExtension = /\.[A-Za-z0-9]+$/.test(cleaned);
  const extension = hasExtension ? "" : (IMAGE_EXTENSION_BY_MIME[attachment.mimeType.toLowerCase()] ?? ".png");
  return `${attachment.id}-${cleaned || "anexo"}${extension}`;
}

export function DiskAttachmentStore(attachmentsDir: string): AttachmentStore {
  function dirFor(issueKey: string): string {
    return join(attachmentsDir, issueKey.toLowerCase());
  }

  return {
    async saveImage(issueKey, attachment, data) {
      const dir = dirFor(issueKey);
      await mkdir(dir, { recursive: true });
      const path = join(dir, attachmentFilename(attachment));
      await writeFile(path, data);
      return path;
    },
    async release(issueKey) {
      await rm(dirFor(issueKey), { recursive: true, force: true }).catch(() => {});
    },
  };
}
