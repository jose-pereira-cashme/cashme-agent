import { readFileSync } from "node:fs";
import type { RepoEntry } from "../../domain/repo.ts";
import type { CatalogSource, RepoCatalog } from "../../application/ports.ts";

export function FileCatalog(path: string): CatalogSource {
  function load(): RepoCatalog {
    const raw = readFileSync(path, "utf8");
    const repos: RepoEntry[] = JSON.parse(raw).repos ?? [];

    function findRepo(name: string | undefined): RepoEntry | null {
      if (!name) return null;
      return repos.find((repo) => repo.name.toLowerCase() === name.toLowerCase()) ?? null;
    }

    return {
      repos,
      findRepo,
    };
  }

  return { load };
}
