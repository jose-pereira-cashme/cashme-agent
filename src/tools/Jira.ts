const JIRA_EMAIL = process.env.JIRA_EMAIL
const JIRA_API_KEY = process.env.JIRA_API_KEY
const JIRA_URL = process.env.JIRA_URL
import type { JiraClient } from "./types.ts";

// Extract readable plain text from a Jira ADF document (comment bodies are ADF).
function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");

  let text = "";
  if (node.type === "text") text += node.text ?? "";
  else if (node.type === "mention") text += node.attrs?.text ?? "";
  else if (node.type === "hardBreak") text += "\n";
  if (node.content) text += adfToText(node.content);
  if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) text += "\n";
  return text;
}

export function Jira(): JiraClient {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_KEY}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function call(path: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`${JIRA_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Jira ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async function getIssue(key: string) {
    const data = await call(`/rest/api/3/issue/${key}?fields=summary,description,issuetype,reporter,comment`);
    const issueFields = data.fields ?? {};
    const description = typeof issueFields.description === "string" ? issueFields.description : JSON.stringify(issueFields.description ?? "");
    const comments = (issueFields.comment?.comments ?? [])
      .map((c: any) => {
        const author = c.author?.displayName ?? "unknown";
        const body = (typeof c.body === "string" ? c.body : adfToText(c.body)).trim();
        return `[${author}] ${body}`;
      })
      .join("\n\n");

    return {
        key: data.key,
        summary: issueFields.summary ?? "",
        description,
        issueType: issueFields.issuetype?.name ?? "Task",
        reporterAccountId: issueFields.reporter?.accountId ?? null,
        reporterDisplayName: issueFields.reporter?.displayName ?? null,
        comments,
    };
  }

  async function getRemoteLinks(key: string): Promise<string[]> {
    const data = await call(`/rest/api/3/issue/${key}/remotelink`);
    return (data ?? [])
      .map((link: any) => link.object?.url)
      .filter((url: unknown): url is string => typeof url === "string");
  }

  async function addComment(key: string, comment: object) {
    await call(`/rest/api/3/issue/${key}/comment`, {
        method: "POST",
        body: JSON.stringify({ body: comment }),
    });
  }
  
  async function transitionIssue(key: string, status: string) {
    const { transitions } = await call(`/rest/api/3/issue/${key}/transitions`);

    const match = (transitions ?? []).find(
        (transition: any) => transition.to?.name?.toLowerCase() === status.toLowerCase(),
    );

    if (!match) throw new Error(`No Jira transition to status "${status}"`);

    await call(`/rest/api/3/issue/${key}/transitions`, {
        method: "POST",
        body: JSON.stringify({ transition: { id: match.id } }),
    });
  }

  return {
    getIssue,
    getRemoteLinks,
    addComment,
    transitionIssue
  }
}
