import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prompts } from "../../application/ports.ts";

// Read once at boot, so a missing prompt file fails the start instead of a job.
export function loadPrompts(promptsDir: string): Prompts {
  const readPrompt = (area: string, key: string): string =>
    readFileSync(join(promptsDir, area, `${key}.md`), "utf8").trim();

  return {
    triage: {
      system: readPrompt("triage", "system"),
      instructions: readPrompt("triage", "instructions"),
    },
    implementation: {
      system: readPrompt("implementation", "system"),
      plan: readPrompt("implementation", "plan"),
      retryNotice: readPrompt("implementation", "retryNotice"),
      resolveConflict: readPrompt("implementation", "resolveConflict"),
    },
    research: {
      system: readPrompt("research", "system"),
      instructions: readPrompt("research", "instructions"),
    },
  };
}
