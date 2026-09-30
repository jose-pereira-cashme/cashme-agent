import { ClaudeAgent } from "./Claude.ts";
import type { AgentRunner, RunOptions, AgentClient } from "./types.ts";
import { config } from "../config.ts";

const BASE_PLAN_TOOLS = ["Read", "Grep", "Glob", "WebFetch"];

const PLAN_TOOLS =
  config.agentProvider === "bedrock" ? BASE_PLAN_TOOLS : [...BASE_PLAN_TOOLS, "WebSearch"];

const PLAN_DISALLOWED_TOOLS = ["Agent", "Task", "AskUserQuestion", "ScheduleWakeup"];

export function Agent(): AgentClient {
  const runner = resolveRunner();

  async function query(prompt: string, systemPrompt: string, allowedTools?: string[]) {
    return runner({ prompt, systemPrompt, allowedTools });
  }

  async function plan({ prompt, systemPrompt, cwd }: Omit<RunOptions, "allowedTools">) {
    return runner({ prompt, systemPrompt, allowedTools: PLAN_TOOLS, disallowedTools: PLAN_DISALLOWED_TOOLS, cwd, permissionMode: "dontAsk" });
  }

  async function run({ prompt, systemPrompt, allowedTools, cwd }: RunOptions) {
    return runner({ prompt, systemPrompt, allowedTools, cwd, permissionMode: "bypassPermissions" });
  }

  return {
    query,
    plan,
    run,
  };
}

function resolveRunner(): AgentRunner {
  return ClaudeAgent();
}
