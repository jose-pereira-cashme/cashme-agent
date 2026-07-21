import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoEntry } from "../types/domain.ts";
import type { CatalogClient } from "./types.ts";

const CATALOG_PATH = process.env.CATALOG_PATH ?? join(process.cwd(), "catalog.json");

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
