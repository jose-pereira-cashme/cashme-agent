import { readFileSync } from "node:fs";
import type { RepoEntry } from "../types/domain.ts";
import type { CatalogClient } from "./types.ts";
import { config } from "../config.ts";

export function Catalog(): CatalogClient {
  const raw = readFileSync(config.catalogPath, "utf8");
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
