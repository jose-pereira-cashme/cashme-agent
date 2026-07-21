export function extractConfluencePageIds(...texts: (string | undefined | null)[]): string[] {
  const ids = new Set<string>();
  const patterns = [/\/wiki\/[^\s"']*?\/pages\/(\d+)/g, /pageId=(\d+)/g];

  for (const text of texts) {
    if (!text) continue;
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        ids.add(match[1]);
      }
    }
  }

  return [...ids];
}
