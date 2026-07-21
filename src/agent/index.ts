import { ClaudeAgent } from "./Claude.ts";
import type { AgentRunner, RunOptions, AgentClient } from "./types.ts";

const PLAN_TOOLS = ["Read", "Grep", "Glob", "WebSearch", "WebFetch"];

// Interactive-only tools the plan agent must never reach in a headless run:
// spawning sub-agents, asking the user, and self-scheduling wake-ups all assume
// a session/loop that doesn't exist here. Removed from the model's context.
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
  // Only the Claude runner is implemented today. When a second provider is
  // added, branch on config.agentProvider here.
  return ClaudeAgent();
}
