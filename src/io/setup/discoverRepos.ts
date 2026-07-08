// Effectful half of repo discovery (F6): gh repo list (best-effort) plus a
// local clone scan, merged into the picker's candidate list. Failures here
// are never errors - they just contribute nothing.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SCAN_ROOTS,
  extractOwnerRepo,
  MAX_REPO_DEPTH,
  mergeDiscovered,
  PRUNE_DIR_NAMES,
  type DiscoveredRepo,
} from "../../domain/setup/repoDiscovery.ts";
import { runCommand, which, type ExecRunner } from "./exec.ts";

interface DiscoverDeps {
  run: ExecRunner;
  which: (cmd: string) => string | null;
}

const GH_TIMEOUT_MS = 30_000;

/**
 * Walk `scanDir` and collect each repo's .git/config. Repos are detected
 * 1..MAX_REPO_DEPTH levels below the root; PRUNE_DIR_NAMES are never
 * descended; the .git directory itself is never walked. Missing/unreadable
 * dirs contribute nothing (F6: not errors).
 */
export function findGitConfigs(scanDir: string): string[] {
  const results: string[] = [];
  function visit(dir: string, depth: number): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (dirNames.includes(".git")) {
      results.push(path.join(dir, ".git", "config"));
    }
    if (depth >= MAX_REPO_DEPTH) return;
    for (const name of dirNames) {
      if (name === ".git" || PRUNE_DIR_NAMES.has(name)) continue;
      visit(path.join(dir, name), depth + 1);
    }
  }
  // Depth counts levels below the scan root: a repo directly under it sits
  // at depth 1 (visit() sees its .git while visiting depth-1 children).
  visit(scanDir, 0);
  return results;
}

/** `gh repo list` as nameWithOwner strings; [] on ANY failure (best-effort). */
export async function ghRepoList(
  deps: DiscoverDeps = { run: runCommand, which },
): Promise<string[]> {
  if (deps.which("gh") === null) return [];
  const result = await deps.run(
    "gh",
    ["repo", "list", "--json", "nameWithOwner", "--limit", "100"],
    GH_TIMEOUT_MS,
  );
  if (result.code !== 0 || result.stdout.trim().length === 0) return [];
  let data: unknown;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) =>
      typeof entry === "object" && entry !== null
        ? (entry as Record<string, unknown>).nameWithOwner
        : undefined,
    )
    .filter((v): v is string => typeof v === "string" && v.includes("/"));
}

function expandHome(p: string, home: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

/** F6: merge `gh repo list` with a local clone scan into a deduped, tagged list. */
export async function discoverRepos(
  home: string,
  workspaceDir: string | undefined,
  deps: DiscoverDeps = { run: runCommand, which },
): Promise<DiscoveredRepo[]> {
  const gh = await ghRepoList(deps);

  const scanDirs = DEFAULT_SCAN_ROOTS.map((name) => path.join(home, name));
  if (workspaceDir !== undefined && workspaceDir.trim().length > 0) {
    const expanded = path.resolve(expandHome(workspaceDir.trim(), home));
    if (!scanDirs.includes(expanded)) scanDirs.push(expanded);
  }

  const local: string[] = [];
  for (const scanDir of scanDirs) {
    for (const config of findGitConfigs(scanDir)) {
      let content: string;
      try {
        content = readFileSync(config, "utf8");
      } catch {
        continue;
      }
      const ownerRepo = extractOwnerRepo(content);
      if (ownerRepo !== null) local.push(ownerRepo);
    }
  }
  return mergeDiscovered(gh, local);
}
