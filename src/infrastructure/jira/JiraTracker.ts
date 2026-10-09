import type { IssueTracker } from "../../application/ports.ts";
import type { Attachment, Issue } from "../../domain/issue.ts";
import type { Report } from "../../domain/report.ts";
import { renderAdf } from "./adfToText.ts";
import { renderReport } from "./comments.ts";

export type JiraOptions = {
  url: string;
  email: string;
  apiKey: string;
};

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

export function JiraTracker(options: JiraOptions): IssueTracker {
  const auth = Buffer.from(`${options.email}:${options.apiKey}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function call(path: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`${options.url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Jira ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async function getIssue(key: string): Promise<Issue> {
    const fields = "summary,description,issuetype,assignee,comment,attachment,*navigable";
    const data = await call(`/rest/api/3/issue/${key}?fields=${fields}&expand=names`);
    const issueFields = data.fields ?? {};
    const comments = (issueFields.comment?.comments ?? [])
      .map((c: any) => `[${c.author?.displayName ?? "unknown"}] ${renderAdf(c.body)}`)
      .join("\n\n");

    const attachments: Attachment[] = (issueFields.attachment ?? []).map((a: any) => ({
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
        assignee: issueFields.assignee?.accountId
          ? { id: issueFields.assignee.accountId, name: issueFields.assignee.displayName ?? null }
          : null,
        comments,
        attachments,
        systemFields: collectSystemFields(issueFields, data.names ?? {}),
    };
  }

  async function downloadAttachment(id: string): Promise<Buffer> {
    const res = await fetch(`${options.url}/rest/api/3/attachment/content/${id}`, {
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

  async function report(key: string, report: Report) {
    await addComment(key, renderReport(report));
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
    report,
    transition: transitionIssue,
  }
}
