import type { RepoEntry } from "../../domain/repo.ts";

export type VerifyResult = {
  verifyPassed: boolean;
  verifyOutput: string;
  changeSummary: string;
  commitMessage: string;
};

export type PreparedRepo = {
  repo: RepoEntry;
  cwd: string;
};

export type SiblingDiff = {
  repo: string;
  diff: string;
};
