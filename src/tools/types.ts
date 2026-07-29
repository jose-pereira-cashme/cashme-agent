import type { JiraIssue, RepoEntry } from "../types/domain.ts";

export type JiraClient = {
  getIssue(key: string): Promise<JiraIssue>;
  getRemoteLinks(key: string): Promise<string[]>;
  addComment(key: string, comment: object): Promise<void>;
  transitionIssue(key: string, status: string): Promise<void>;
};

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
  }): Promise<void>;
  push(cwd: string, branch: string): Promise<void>;
  cleanup(cwd: string): Promise<void>;
};

export type GithubClient = {
  createPr(args: {
    cwd: string; base: string; head: string; title: string; body: string;
  }): Promise<string>;
};

export type CatalogClient = {
  repos: RepoEntry[];
  findRepo(name: string | undefined): RepoEntry | null;
};

export type ConfluencePage = {
  id: string;
  title: string;
  text: string;
};

export type ConfluenceClient = {
  getPage(id: string): Promise<ConfluencePage>;
};
