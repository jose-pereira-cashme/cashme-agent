import type { DocsSource, LinkedPage } from "../../application/ports.ts";
import { extractConfluencePageIds } from "./links.ts";

export type ConfluenceOptions = {
  url: string;
  email: string;
  apiKey: string;
};

export function ConfluenceDocs(options: ConfluenceOptions): DocsSource {
  const auth = Buffer.from(`${options.email}:${options.apiKey}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  async function getPage(id: string): Promise<LinkedPage> {
    const res = await fetch(`${options.url}/wiki/api/v2/pages/${id}?body-format=storage`, { headers });
    if (!res.ok) throw new Error(`Confluence GET page ${id} failed: ${res.status}`);
    const data = await res.json();
    return {
      id: String(data.id ?? id),
      title: data.title ?? "",
      text: storageToText(data.body?.storage?.value ?? ""),
    };
  }

  function linkedPageIds(texts: string[]): string[] {
    return extractConfluencePageIds(...texts);
  }

  return { linkedPageIds, getPage };
}

// Convert Confluence "storage" XHTML into readable plain text for the agent.
function storageToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|div|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
