export function extractConfluencePageIds(...texts: (string | undefined | null)[]): string[] {
  const ids = new Set<string>();
  const patterns = [/\/wiki\/[^\s"']*?\/pages\/(\d+)/g, /pageId=(\d+)/g];
  // Confluence "tiny links" (/wiki/x/<hash>) encode the page id in the hash
  // rather than spelling it out, so they need decoding instead of a capture.
  const tinyPattern = /\/wiki\/x\/([A-Za-z0-9_-]+)/g;

  for (const text of texts) {
    if (!text) continue;
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        ids.add(match[1]);
      }
    }
    for (const match of text.matchAll(tinyPattern)) {
      const id = decodeTinyLink(match[1]);
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

// A tiny-link hash is the page id serialised as little-endian bytes, then
// base64url-encoded. Decode it back: base64url → bytes → integer → id string.
// Returns null if the hash isn't valid base64url or decodes to a non-positive id.
function decodeTinyLink(hash: string): string | null {
  try {
    const bytes = Buffer.from(hash, "base64url");
    if (bytes.length === 0) return null;
    let id = 0n;
    for (let i = bytes.length - 1; i >= 0; i--) {
      id = (id << 8n) | BigInt(bytes[i]);
    }
    return id > 0n ? id.toString() : null;
  } catch {
    return null;
  }
}
