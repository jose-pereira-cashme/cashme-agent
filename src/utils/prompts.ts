import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";
import type { JiraIssue } from "../types/domain.ts";

export function readPrompt(area: string, key: string): string {
  return readFileSync(join(config.promptsDir, area, `${key}.md`), "utf8").trim();
}

export function formatReferenceImages(issue: JiraIssue): string {
  const images = issue.referenceImages ?? [];
  if (images.length === 0) return "";
  return [
    "Reference images attached to the ticket. Open EVERY one with the Read tool before",
    "implementing anything visual — they are the source of truth for layout, spacing,",
    "colours and any copy shown in them:",
    ...images.map((path) => `- ${path}`), 
  ].join("\n");
}
