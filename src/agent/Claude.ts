import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRunner } from "./types.ts";
import { config } from "../config.ts";

function describeToolUse(name: string, input: unknown): string {
    const obj = (input ?? {}) as Record<string, unknown>;
    if (name === "Bash" && typeof obj.command === "string") return `$ ${obj.command}`;
    if (typeof obj.file_path === "string") return obj.file_path;
    const json = JSON.stringify(obj);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

function agentEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value;
    }
    env.CLAUDE_CODE_MAX_RETRIES = "2";

    if (config.agentProvider === "bedrock") {
        delete env.ANTHROPIC_API_KEY;
        env.CLAUDE_CODE_USE_BEDROCK = "1";
        env.AWS_REGION = config.bedrock.region;
        if (config.bedrock.apiKey) env.AWS_BEARER_TOKEN_BEDROCK = config.bedrock.apiKey;
        env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.bedrock.sonnetModel;
        return env;
    }

    env.ANTHROPIC_API_KEY = config.anthropicApiKey;
    return env;
}

export function ClaudeAgent(): AgentRunner {
    const env = agentEnv();

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
                env,
            },
        })) {
            if (message.type === "assistant") {
                let text = "";
                for (const block of message.message.content) {
                    if (block.type === "text") text += block.text;
                    if (block.type === "tool_use") {
                        console.log(`[agent tool] ${block.name} ${describeToolUse(block.name, block.input)}`);
                    }
                }
                if (text) finalText = text;
            }
        }
        return finalText;
    } 
}
