export type PermissionMode =
  | "default" // Standard permission behavior
  | "acceptEdits" // Auto-accept file edits
  | "bypassPermissions" // Bypass permission checks; explicit ask rules still prompt
  | "plan" // Planning mode - explore without editing
  | "dontAsk" // Don't prompt for permissions, deny if not pre-approved
  | "auto"; // Use a model classifier to approve or deny each tool call

export type AgentRunner = (opts: {
  prompt: string;
  systemPrompt: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  cwd?: string;
}) => Promise<string>;

export type AgentOptions = {
  provider: "claude" | "bedrock";
  anthropicApiKey: string;
  bedrock: { region: string; apiKey: string; sonnetModel: string };
};
