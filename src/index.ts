import { config } from './config.ts';
import type { Deps } from './application/ports.ts';
import { createHandleAgentRequest } from './application/handleAgentRequest.ts';
import { JiraTracker } from './infrastructure/jira/JiraTracker.ts';
import { ConfluenceDocs } from './infrastructure/confluence/ConfluenceDocs.ts';
import { Git } from './infrastructure/git/Git.ts';
import { Github } from './infrastructure/github/Github.ts';
import { FileCatalog } from './infrastructure/catalog/FileCatalog.ts';
import { Agent } from './infrastructure/agent/Agent.ts';
import { DiskAttachmentStore } from './infrastructure/files/AttachmentStore.ts';
import { extractDocxText } from './infrastructure/files/docx.ts';
import { loadPrompts } from './infrastructure/prompts/loadPrompts.ts';
import { createQueue } from './entrypoints/queue.ts';
import { startHttp } from './entrypoints/http.ts';

// Composition root: the only module that knows every layer.
const deps: Deps = {
  tracker: JiraTracker(config.jira),
  docs: ConfluenceDocs(config.jira),
  git: Git({ mirrorsDir: config.mirrorsDir, githubToken: config.github.token }),
  codeHost: Github({ token: config.github.token }),
  catalog: FileCatalog(config.catalogPath),
  agent: Agent({ provider: config.agentProvider, anthropicApiKey: config.anthropicApiKey, bedrock: config.bedrock }),
  attachments: DiskAttachmentStore(config.attachmentsDir),
  parser: { docxToText: extractDocxText },
  prompts: loadPrompts(config.promptsDir),
  settings: {
    maxVerifyAttempts: config.maxVerifyAttempts,
    reviewStatus: config.jiraReviewStatus,
    replicaBases: config.replicaBases,
  },
};

const queue = createQueue(createHandleAgentRequest(deps));

startHttp({ port: config.port, secret: config.agentSecret, enqueue: queue.enqueue });
