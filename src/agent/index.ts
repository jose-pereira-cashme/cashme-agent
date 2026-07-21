import { ClaudeAgent } from "./Claude.ts";
import type { AgentRunner, RunOptions, AgentClient } from "./types.ts";
import { config } from "../config.ts";

// Read-only toolset for the plan step: inspect the repos and look things up on
// the web, nothing that can mutate the filesystem. Bash is deliberately left out
// — it's a write vector (and how the agent used to smuggle a plan file to disk).
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

  // Runs the agent read-only: permissionMode "dontAsk" denies any tool not in
  // the read-only PLAN_TOOLS whitelist, so it investigates but cannot edit, run
  // shell commands, or write files. Returns the plan as the agent's final text.
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
  switch (config.agentProvider) {
    case "claude":
      return ClaudeAgent();
    // Other providers not implemented.
    default:
      return ClaudeAgent();
  }
}
