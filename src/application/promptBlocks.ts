import type { Issue } from "../domain/issue.ts";

export function formatReferenceImages(issue: Issue): string {
  const images = issue.referenceImages ?? [];
  if (images.length === 0) return "";
  return [
    "Reference images attached to the ticket. Open EVERY one with the Read tool before",
    "implementing anything visual — they are the source of truth for layout, spacing,",
    "colours and any copy shown in them:",
    ...images.map((path) => `- ${path}`),
  ].join("\n");
}

// The ticket context every agent prompt carries after its own header line.
// Empty entries are kept so callers drop them with the same filter(Boolean).
export function issueContextBlocks(issue: Issue): string[] {
  return [
    `Description:\n${issue.description}`,
    issue.linkedDocs ? `Linked documentation:\n${issue.linkedDocs}` : "",
    formatReferenceImages(issue),
    issue.comments ? `Ticket comments (chronological):\n${issue.comments}` : "",
  ];
}
