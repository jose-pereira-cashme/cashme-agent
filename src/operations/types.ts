import type { RepoEntry } from "../types/domain.ts";

export type VerifyResult = {
  verifyPassed: boolean;
  verifyOutput: string;
  changeSummary: string;
};

// A repo whose working copy + branch are ready for implementation.
export type PreparedRepo = {
  repo: RepoEntry;
  cwd: string;
};

// A change already implemented in an earlier repo this run, passed as a
// replication hint to subsequent repos.
export type SiblingDiff = {
  repo: string;
  diff: string;
};

export type RepoOutcome = {
  repo: string;
  summary?: string;
  prUrl?: string;
  reason?: string;
};
