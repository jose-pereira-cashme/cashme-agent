import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRunner } from "./types.ts";

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY

function describeToolUse(name: string, input: unknown): string {
    const obj = (input ?? {}) as Record<string, unknown>;
    if (name === "Bash" && typeof obj.command === "string") return `$ ${obj.command}`;
    if (typeof obj.file_path === "string") return obj.file_path;
    const json = JSON.stringify(obj);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

export function ClaudeAgent(): AgentRunner {
    return async ({ prompt, systemPrompt, allowedTools, disallowedTools, permissionMode, cwd }) => {
        let finalText = "";
        for await (const message of query({
            prompt,
            options: {
                systemPrompt,
                allowedTools,
                disallowedTools,
                permissionMode,
                cwd,
                settingSources: ['project'],
                skills: 'all',
                effort: 'medium',
                model: 'sonnet',
                env: { ...process.env, ANTHROPIC_API_KEY: CLAUDE_API_KEY, CLAUDE_CODE_MAX_RETRIES: "2" },
            },
        })) {
            if (message.type === "assistant") {
                let text = "";
                for (const block of message.message.content) {
                    if (block.type === "text") text += block.text;
                    if (block.type === "tool_use") {
                        // Log every tool call so installs / shell commands the
                        // agent runs are visible (e.g. an unexpected `yarn add`).
                        console.log(`[agent tool] ${block.name} ${describeToolUse(block.name, block.input)}`);
                    }
                }
                if (text) finalText = text;
            }
        }
        return finalText;
    } 
}
