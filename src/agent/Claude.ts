import { query } from "@anthropic-ai/claude-agent-sdk";

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY

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
  permissionMode?: PermissionMode;
  cwd?: string;
}) => Promise<string>;

export function ClaudeAgent(): AgentRunner {
    return async ({ prompt, systemPrompt, allowedTools, permissionMode, cwd }) => {
        let finalText = "";
        for await (const message of query({
            prompt,
            options: {
                systemPrompt,
                allowedTools,
                permissionMode,
                cwd,
                skills: 'all',
                effort: 'medium',
                model: 'sonnet',
                env: { ANTHROPIC_API_KEY: CLAUDE_API_KEY, CLAUDE_CODE_MAX_RETRIES: "2", },
            },
        })) {
            if (message.type === "assistant") {
                let text = "";
                for (const block of message.message.content) {
                    if (block.type === "text") text += block.text;
                }
                if (text) finalText = text;
            }
        }
        return finalText;
    } 
}
