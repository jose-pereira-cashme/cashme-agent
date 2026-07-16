import { readFileSync } from "node:fs";
import { join } from "node:path";

const CATALOG_PATH = process.env.CATALOG_PATH ?? join(process.cwd(), "catalog.json");

export interface RepoEntry {
  name: string;
  description: string;
  url: string;
  defaultBranch: string;
}

export interface CatalogClient {
  repos: RepoEntry[];
  findRepo(name: string | undefined): RepoEntry | null;
}

export function Catalog(): CatalogClient {
  const raw = readFileSync(CATALOG_PATH, "utf8");
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
