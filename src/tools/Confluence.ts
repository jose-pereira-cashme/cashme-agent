import type { ConfluenceClient, ConfluencePage } from "./types.ts";

const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_KEY = process.env.JIRA_API_KEY;
const JIRA_URL = process.env.JIRA_URL;

export function Confluence(): ConfluenceClient {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  async function getPage(id: string): Promise<ConfluencePage> {
    const res = await fetch(`${JIRA_URL}/wiki/api/v2/pages/${id}?body-format=storage`, { headers });
    if (!res.ok) throw new Error(`Confluence GET page ${id} failed: ${res.status}`);
    const data = await res.json();
    return {
      id: String(data.id ?? id),
      title: data.title ?? "",
      text: storageToText(data.body?.storage?.value ?? ""),
    };
  }

  return { getPage };
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
