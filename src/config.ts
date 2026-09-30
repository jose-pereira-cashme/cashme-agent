import { join } from "node:path";
import { tmpdir } from "node:os";

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

const agentProvider = optional("AGENT_PROVIDER", "claude");

if (agentProvider !== "claude" && agentProvider !== "bedrock") {
  throw new Error(`Unknown AGENT_PROVIDER "${agentProvider}" (expected "claude" or "bedrock")`);
}

const agentSecret = required("AGENT_SECRET");

const anthropicApiKey = agentProvider === "claude" ? required("ANTHROPIC_API_KEY") : optional("ANTHROPIC_API_KEY", "");
const bedrockRegion = agentProvider === "bedrock" ? required("AWS_REGION") : optional("AWS_REGION", "");
const bedrockApiKey = optional("AWS_BEARER_TOKEN_BEDROCK", optional("AWS_BEDROCK_API_KEY", ""))
const bedrockSonnetModel = optional("BEDROCK_SONNET_MODEL", "us.anthropic.claude-sonnet-5");

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
  agentProvider,
  bedrock: Object.freeze({ region: bedrockRegion, apiKey: bedrockApiKey, sonnetModel: bedrockSonnetModel }),
  jira: Object.freeze({ email: jiraEmail, apiKey: jiraApiKey, url: jiraUrl }),
  github: Object.freeze({ token: githubToken }),
  mirrorsDir: optional("MIRRORS_DIR", join(tmpdir(), "cashme-agent-mirrors")),
  catalogPath: optional("CATALOG_PATH", join(process.cwd(), "catalog.json")),
  promptsDir: optional("PROMPTS_DIR", join(process.cwd(), "prompts")),
  maxVerifyAttempts: Number(optional("MAX_VERIFY_ATTEMPTS", "3")),
  jiraReviewStatus: optional("JIRA_REVIEW_STATUS", "Em revisão"),
  replicaBases: Object.freeze(replicaBases),
});
