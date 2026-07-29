import { join } from "node:path";
import { tmpdir } from "node:os";

// Single source of truth for environment configuration. Reads every var once,
// applies defaults, and fails fast at import time if a required var is missing —
// so a misconfigured deploy dies at boot with a clear message instead of later
// with a cryptic auth error. Imported (transitively) from src/index.ts at startup.

const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    missing.push(name);
    return "";
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

const replicaBases = ["develop", "qa"];

const agentSecret = required("AGENT_SECRET");
const anthropicApiKey = required("ANTHROPIC_API_KEY");
const jiraEmail = required("JIRA_EMAIL");
const jiraApiKey = required("JIRA_API_KEY");
const jiraUrl = required("JIRA_URL");
const githubToken = required("GITHUB_TOKEN");

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export const config = Object.freeze({
  port: Number(optional("PORT", "3000")),
  agentSecret,
  anthropicApiKey,
  agentProvider: optional("AGENT_PROVIDER", "claude"),
  jira: Object.freeze({ email: jiraEmail, apiKey: jiraApiKey, url: jiraUrl }),
  github: Object.freeze({ token: githubToken }),
  mirrorsDir: optional("MIRRORS_DIR", join(tmpdir(), "cashme-agent-mirrors")),
  catalogPath: optional("CATALOG_PATH", join(process.cwd(), "catalog.json")),
  promptsDir: optional("PROMPTS_DIR", join(process.cwd(), "prompts")),
  maxVerifyAttempts: Number(optional("MAX_VERIFY_ATTEMPTS", "3")),
  jiraReviewStatus: optional("JIRA_REVIEW_STATUS", "Em revisão"),
  replicaBases: Object.freeze(replicaBases),
});
