export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  reporterAccountId: string | null;
  reporterDisplayName: string | null;
  comments: string;
  linkedDocs?: string;
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
