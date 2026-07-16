const JIRA_EMAIL = process.env.JIRA_EMAIL
const JIRA_API_KEY = process.env.JIRA_API_KEY
const JIRA_URL = process.env.JIRA_URL

interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  reporterAccountId: string | null;
  reporterDisplayName: string | null;
}

interface JiraClient {
  getIssue(key: string): Promise<JiraIssue>;
  addComment(key: string, comment: object): Promise<void>;
  transitionIssue(key: string, status: string): Promise<void>;
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
    const data = await call(`/rest/api/3/issue/${key}?fields=summary,description,issuetype,reporter`);
    const issueFields = data.fields ?? {};
    const description = typeof issueFields.description === "string" ? issueFields.description : JSON.stringify(issueFields.description ?? "");

    return {
        key: data.key,
        summary: issueFields.summary ?? "",
        description,
        issueType: issueFields.issuetype?.name ?? "Task",
        reporterAccountId: issueFields.reporter?.accountId ?? null,
        reporterDisplayName: issueFields.reporter?.displayName ?? null,
    };
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
    addComment,
    transitionIssue
  }
}
