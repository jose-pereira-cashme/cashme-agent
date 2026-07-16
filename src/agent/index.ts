import { ClaudeAgent, type AgentRunner } from "./Claude.ts";

const AGENT_PROVIDER = process.env.AGENT_PROVIDER ?? "claude";

interface ImplementOptions {
  prompt: string;
  systemPrompt: string;
  cwd: string;
  allowedTools?: string[];
}

interface ResearchOptions {
  prompt: string;
  systemPrompt: string;
  allowedTools?: string[];
}

interface AgentClient {
  query(prompt: string, systemPrompt: string, allowedTools?: string[]): Promise<string>;
  plan(prompt: string, systemPrompt: string): Promise<string>;
  implement(options: ImplementOptions): Promise<string>;
  research(options: ResearchOptions): Promise<string>;
}

export function Agent(): AgentClient {
  const runner = resolveRunner();

  async function query(prompt: string, systemPrompt: string, allowedTools?: string[]) {
    return runner({ prompt, systemPrompt, allowedTools });
  }

  async function plan(prompt: string, systemPrompt: string) {
    return runner({ prompt, systemPrompt, permissionMode: "plan" });
  }

  // Runs the agent inside a working copy with edits + tools enabled, so it can
  // modify files and run the project's own verification.
  async function implement({ prompt, systemPrompt, cwd, allowedTools }: ImplementOptions) {
    return runner({ prompt, systemPrompt, cwd, allowedTools, permissionMode: "bypassPermissions" });
  }

  // Runs the agent with tools enabled but no working copy — it investigates the
  // repo paths named in the prompt (read-only) instead of editing a single cwd.
  async function research({ prompt, systemPrompt, allowedTools }: ResearchOptions) {
    return runner({ prompt, systemPrompt, allowedTools, permissionMode: "bypassPermissions" });
  }

  return {
    query,
    plan,
    implement,
    research,
  };
}

function resolveRunner(): AgentRunner {
  switch (AGENT_PROVIDER) {
    case "claude":
      return ClaudeAgent();
    // Other providers not implemented.
    default:
      return ClaudeAgent();
  }
}
