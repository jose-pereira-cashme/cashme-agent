import type { Issue } from "../../domain/issue.ts";
import type { Deps } from "../ports.ts";

export async function collectLinkedDocs(deps: Pick<Deps, "tracker" | "docs">, issue: Issue): Promise<string> {
  const log = (msg: string) => console.log(`[docs ${issue.key}] ${msg}`);

  let remoteUrls: string[] = [];
  try {
    remoteUrls = await deps.tracker.getRemoteLinks(issue.key);
  } catch (err) {
    log(`remote-link lookup failed (continuing): ${(err as Error).message}`);
  }

  const pageIds = deps.docs.linkedPageIds([issue.description, ...remoteUrls]);
  if (pageIds.length === 0) {
    return "";
  }
  log(`found ${pageIds.length} linked page(s): ${pageIds.join(", ")}`);

  const blocks: string[] = [];
  for (const id of pageIds) {
    try {
      const page = await deps.docs.getPage(id);
      blocks.push(`### Confluence: ${page.title}\n${page.text}`);
    } catch (err) {
      log(`failed to fetch page ${id} (skipping): ${(err as Error).message}`);
    }
  }

  return blocks.join("\n\n");
}
