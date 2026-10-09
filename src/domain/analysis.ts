export type AgentAnalyses = {
  taskType: "implementation" | "research" | "other";
  repoNames: string[];
  reason: string;
  userPrompt: string;
};
