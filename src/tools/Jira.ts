import type { JiraClient } from "./types.ts";
import type { JiraAttachment } from "../types/domain.ts";
import { config } from "../config.ts";

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

function renderAdf(body: unknown): string {
  if (typeof body === "string") return body.trim();
  return adfToText(body).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function renderFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(renderFieldValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["value", "name", "displayName", "label"]) {
      if (typeof obj[key] === "string") return (obj[key] as string).trim();
    }
  }
  return "";
}

function collectSystemFields(fields: Record<string, unknown>, names: Record<string, string>): string {
  return Object.entries(names)
    .filter(([, label]) => /sistema/i.test(label ?? ""))
    .map(([id, label]) => [label, renderFieldValue(fields[id])] as const)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export function Jira(): JiraClient {
  const auth = Buffer.from(`${config.jira.email}:${config.jira.apiKey}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function call(path: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`${config.jira.url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Jira ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async function getIssue(key: string) {
    const fields = "summary,description,issuetype,reporter,comment,attachment,*navigable";
    const data = await call(`/rest/api/3/issue/${key}?fields=${fields}&expand=names`);
    const issueFields = data.fields ?? {};
    const comments = (issueFields.comment?.comments ?? [])
      .map((c: any) => `[${c.author?.displayName ?? "unknown"}] ${renderAdf(c.body)}`)
      .join("\n\n");

    const attachments: JiraAttachment[] = (issueFields.attachment ?? []).map((a: any) => ({
      id: String(a.id),
      filename: a.filename ?? "",
      mimeType: a.mimeType ?? "",
      size: Number(a.size ?? 0),
    }));

    return {
        key: data.key,
        summary: issueFields.summary ?? "",
        description: renderAdf(issueFields.description),
        issueType: issueFields.issuetype?.name ?? "Task",
        reporterAccountId: issueFields.reporter?.accountId ?? null,
        reporterDisplayName: issueFields.reporter?.displayName ?? null,
        comments,
        attachments,
        systemFields: collectSystemFields(issueFields, data.names ?? {}),
    };
  }

  async function downloadAttachment(id: string): Promise<Buffer> {
    const res = await fetch(`${config.jira.url}/rest/api/3/attachment/content/${id}`, {
      headers: { Authorization: `Basic ${auth}` },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Jira attachment ${id} download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
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
    downloadAttachment,
    addComment,
    transitionIssue
  }
}
