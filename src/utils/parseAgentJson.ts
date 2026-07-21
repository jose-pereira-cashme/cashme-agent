// Agents reply in free text that usually contains one JSON object. This finds
// the FIRST complete top-level object (matching braces, string-aware) and parses
// it. Returns null when there's no object or it doesn't parse — callers decide
// how to handle that. Preferred over a greedy /\{[\s\S]*\}/ match, which spans
// from the first "{" to the last "}" and breaks on braces in prose or a second
// object.
export function parseAgentJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(raw.slice(start, i + 1));
          return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
