// Shared domain vocabulary for the cashme-agent pipeline — types that cross
// module boundaries (webhook handler, operations, and the Jira/Catalog tools).
// Neutral home so no layer has to import "upward" from another.

export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  reporterAccountId: string | null;
  reporterDisplayName: string | null;
  // All ticket comments, chronological, formatted "[author] body" ("" when none).
  comments: string;
  // Text of any Confluence pages linked from the issue; set by collectLinkedDocs
  // (absent until that step runs, empty string when none are found).
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
