import type { Attachment, Issue } from "../domain/issue.ts";
import type { RepoEntry } from "../domain/repo.ts";
import type { Report } from "../domain/report.ts";

// Every phase of an operation logs through the same prefixed logger.
export type Logger = (msg: string) => void;

export type IssueTracker = {
  getIssue(key: string): Promise<Issue>;
  getRemoteLinks(key: string): Promise<string[]>;
  downloadAttachment(id: string): Promise<Buffer>;
  report(key: string, report: Report): Promise<void>;
  transition(key: string, status: string): Promise<void>;
};

export type LinkedPage = {
  id: string;
  title: string;
  text: string;
};

export type DocsSource = {
  linkedPageIds(texts: string[]): string[];
  getPage(id: string): Promise<LinkedPage>;
};

export type ReplicationResult =
  | { replicated: false }
  | { replicated: true; resolvedFiles: string[] };

export type GitClient = {
  ensureMirror(repo: RepoEntry): Promise<string>;
  makeWorkingCopy(repo: RepoEntry, jobId: string): Promise<string>;
  createBranch(cwd: string, branch: string, base: string): Promise<void>;
  diff(cwd: string, base: string): Promise<string>;
  status(cwd: string): Promise<Array<{ path: string; untracked: boolean }>>;
  restoreFile(cwd: string, path: string, untracked: boolean): Promise<void>;
  commitAll(cwd: string, message: string): Promise<void>;
  hasRemoteBranch(cwd: string, branch: string): Promise<boolean>;
  replicateCommits(cwd: string, args: {
    branch: string; base: string; fromRef: string; fromBase: string;
    onConflict?: (files: string[]) => Promise<void>;
  }): Promise<ReplicationResult>;
  push(cwd: string, branch: string): Promise<void>;
  cleanup(cwd: string): Promise<void>;
};

export type CodeHost = {
  createPr(args: {
    cwd: string; base: string; head: string; title: string; body: string;
  }): Promise<string>;
};

export type RepoCatalog = {
  repos: RepoEntry[];
  findRepo(name: string | undefined): RepoEntry | null;
};

// Loaded per job, so an edited catalog applies without a restart.
export type CatalogSource = {
  load(): RepoCatalog;
};

export type RunOptions = {
  prompt: string;
  systemPrompt: string;
  allowedTools?: string[];
  cwd?: string;
};

export type AgentClient = {
  query(prompt: string, systemPrompt: string, allowedTools?: string[]): Promise<string>;
  plan(options: Omit<RunOptions, "allowedTools">): Promise<string>;
  run(options: RunOptions): Promise<string>;
};

export type AttachmentStore = {
  saveImage(issueKey: string, attachment: Attachment, data: Buffer): Promise<string>;
  release(issueKey: string): Promise<void>;
};

export type DocumentParser = {
  docxToText(data: Buffer): string;
};

export type Prompts = {
  triage: { system: string; instructions: string };
  implementation: { system: string; plan: string; retryNotice: string; resolveConflict: string };
  research: { system: string; instructions: string };
};

export type Settings = {
  maxVerifyAttempts: number;
  reviewStatus: string;
  replicaBases: readonly string[];
};

export type Deps = {
  tracker: IssueTracker;
  docs: DocsSource;
  git: GitClient;
  codeHost: CodeHost;
  catalog: CatalogSource;
  agent: AgentClient;
  attachments: AttachmentStore;
  parser: DocumentParser;
  prompts: Prompts;
  settings: Settings;
};
