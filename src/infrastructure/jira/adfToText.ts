const ADF_BLOCK_TYPES = new Set([
  "paragraph", "heading", "blockquote", "codeBlock", "rule", "tableRow", "mediaSingle",
]);

function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");

  let text = "";
  switch (node.type) {
    case "text": {
      const raw = node.text ?? "";
      const href = (node.marks ?? []).find((mark: any) => mark.type === "link")?.attrs?.href;
      // Keep the target: a URL cited in a ticket is often a reference the agent
      // is expected to open, and link text alone loses it.
      text += href && href !== raw ? `${raw} (${href})` : raw;
      break;
    }
    case "mention":
      text += node.attrs?.text ?? "";
      break;
    case "hardBreak":
      text += "\n";
      break;
    case "inlineCard":
    case "blockCard":
    case "embedCard":
      text += node.attrs?.url ?? "";
      break;
    // An embedded image carries only an opaque media id, not a filename or URL.
    // The readable copy reaches the agent through the attachment list instead,
    // so just mark the spot.
    case "media":
    case "mediaInline":
      text += `[imagem anexada${node.attrs?.alt ? `: ${node.attrs.alt}` : ""}]`;
      break;
    case "rule":
      text += "---";
      break;
    case "heading":
      text += `${"#".repeat(node.attrs?.level ?? 1)} `;
      break;
    case "listItem":
      text += "- ";
      break;
  }

  if (node.content) text += adfToText(node.content);
  if (ADF_BLOCK_TYPES.has(node.type)) text += "\n";
  return text;
}

export function renderAdf(body: unknown): string {
  if (typeof body === "string") return body.trim();
  return adfToText(body).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
