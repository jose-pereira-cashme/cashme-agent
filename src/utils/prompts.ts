import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = process.env.PROMPTS_DIR ?? join(process.cwd(), "prompts");

export function readPrompt(area: string, key: string): string {
  return readFileSync(join(PROMPTS_DIR, area, `${key}.md`), "utf8").trim();
}
