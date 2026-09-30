export type JiraAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  reporterAccountId: string | null;
  reporterDisplayName: string | null;
  comments: string;
  attachments: JiraAttachment[];
  systemFields: string;
  linkedDocs?: string;
  referenceImages?: string[];
};

export type AgentAnalyses = {
  taskType: "implementation" | "research" | "other";
  repoNames: string[];
  reason: string;
  userPrompt: string;
};

export type RepoEntry = {
  name: string;
  description: string;
  url: string;
  defaultBranch: string;
};
