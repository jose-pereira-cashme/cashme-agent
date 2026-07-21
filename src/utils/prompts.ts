import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";

export function readPrompt(area: string, key: string): string {
  return readFileSync(join(config.promptsDir, area, `${key}.md`), "utf8").trim();
}
