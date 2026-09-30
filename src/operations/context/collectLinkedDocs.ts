import { Jira } from "../../tools/Jira.ts";
import { Confluence } from "../../tools/Confluence.ts";
import { extractConfluencePageIds } from "../../utils/confluenceLinks.ts";
import type { JiraIssue } from "../../types/domain.ts";

export async function collectLinkedDocs(issue: JiraIssue): Promise<string> {
  const jira = Jira();
  const confluence = Confluence();
  const log = (msg: string) => console.log(`[docs ${issue.key}] ${msg}`);

  let remoteUrls: string[] = [];
  try {
    remoteUrls = await jira.getRemoteLinks(issue.key);
  } catch (err) {
    log(`remote-link lookup failed (continuing): ${(err as Error).message}`);
  }

  const pageIds = extractConfluencePageIds(issue.description, ...remoteUrls);
  if (pageIds.length === 0) {
    return "";
  }
  log(`found ${pageIds.length} linked page(s): ${pageIds.join(", ")}`);

  const blocks: string[] = [];
  for (const id of pageIds) {
    try {
      const page = await confluence.getPage(id);
      blocks.push(`### Confluence: ${page.title}\n${page.text}`);
    } catch (err) {
      log(`failed to fetch page ${id} (skipping): ${(err as Error).message}`);
    }
  }

  return blocks.join("\n\n");
}
