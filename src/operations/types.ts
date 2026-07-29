import type { RepoEntry } from "../types/domain.ts";

// Every phase of an operation logs through the same prefixed logger.
export type Logger = (msg: string) => void;

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

// One extra base (develop, qa, …) that received a copy of the work branch.
export type ReplicaOutcome = {
  base: string;
  branch: string;
  prUrl?: string;
  reason?: string;
};

export type RepoOutcome = {
  repo: string;
  summary?: string;
  branch?: string;
  reason?: string;
  replicas?: ReplicaOutcome[];
};
