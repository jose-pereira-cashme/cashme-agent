import type { RepoEntry } from "../types/domain.ts";

export type VerifyResult = {
  verifyPassed: boolean;
  verifyOutput: string;
  changeSummary: string;
};

export type PreparedRepo = {
  repo: RepoEntry;
  cwd: string;
};

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
