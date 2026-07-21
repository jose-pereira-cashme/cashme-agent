import { run } from "../utils/exec.ts";
import type { GithubClient } from "./types.ts";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

export function Github(): GithubClient {
  const env = { GH_TOKEN: GITHUB_TOKEN };

  return {
    async createPr({ cwd, base, head, title, body }) {
      const r = await run(
        "gh",
        ["pr", "create", "--base", base, "--head", head, "--title", title, "--body", body],
        { cwd, env },
      );
      if (r.code === 0) return r.stdout.trim();

      // Branch may already have an open PR (e.g. a retry of the same ticket after a
      // force-push updated the branch). Reuse the existing PR instead of failing.
      const combined = `${r.stderr}\n${r.stdout}`;
      if (/already exists/i.test(combined)) {
        console.log(`[github] a PR already exists for ${head}; reusing it (branch was updated).`);
        const view = await run(
          "gh",
          ["pr", "view", head, "--json", "url", "--jq", ".url"],
          { cwd, env },
        );
        if (view.code === 0 && view.stdout.trim()) return view.stdout.trim();
        throw new Error(`gh pr view failed after detecting an existing PR: ${view.stderr || view.stdout}`);
      }
      throw new Error(`gh pr create failed: ${r.stderr || r.stdout}`);
    },
  };
}
