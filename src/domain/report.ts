import type { Assignee } from "./issue.ts";
import type { RepoOutcome } from "./outcomes.ts";

// What the automation tells the ticket, as data. The tracker adapter decides
// how each kind is rendered.
export type Report =
  | { kind: "failure"; reason: string; assignee: Assignee | null }
  | { kind: "needsInfo"; triageReason: string; assignee: Assignee | null }
  | { kind: "implementation"; results: RepoOutcome[]; assignee: Assignee | null }
  | { kind: "research"; findings: string; assignee: Assignee | null };
