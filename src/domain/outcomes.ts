// One extra base (develop, qa, …) that received a copy of the work branch.
export type ReplicaOutcome = {
  base: string;
  branch: string;
  prUrl?: string;
  reason?: string;
  resolvedFiles?: string[];
  upToDate?: boolean;
};

export type RepoOutcome = {
  repo: string;
  summary?: string;
  branch?: string;
  reason?: string;
  replicas?: ReplicaOutcome[];
};
