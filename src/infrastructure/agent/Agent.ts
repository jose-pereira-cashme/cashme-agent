import { ClaudeRunner } from "./ClaudeRunner.ts";
import type { AgentOptions, AgentRunner } from "./types.ts";
import type { AgentClient, RunOptions } from "../../application/ports.ts";

const BASE_PLAN_TOOLS = ["Read", "Grep", "Glob", "WebFetch"];

const PLAN_DISALLOWED_TOOLS = ["Agent", "Task", "AskUserQuestion", "ScheduleWakeup"];

export function Agent(options: AgentOptions): AgentClient {
  const runner = resolveRunner(options);
  const planTools = options.provider === "bedrock" ? BASE_PLAN_TOOLS : [...BASE_PLAN_TOOLS, "WebSearch"];

  async function query(prompt: string, systemPrompt: string, allowedTools?: string[]) {
    return runner({ prompt, systemPrompt, allowedTools });
  }

  async function plan({ prompt, systemPrompt, cwd }: Omit<RunOptions, "allowedTools">) {
    return runner({ prompt, systemPrompt, allowedTools: planTools, disallowedTools: PLAN_DISALLOWED_TOOLS, cwd, permissionMode: "dontAsk" });
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

function resolveRunner(options: AgentOptions): AgentRunner {
  return ClaudeRunner(options);
}
