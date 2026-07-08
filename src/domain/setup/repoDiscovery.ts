// Pure half of repo discovery (F6): origin-URL parsing, .git/config parsing,
// and the gh+local merge that feeds the discovery picker.

/** One mergeable discovery hit, tagged by where it was found (F6). */
export interface DiscoveredRepo {
  owner: string;
  repo: string;
  sources: Array<"gh" | "local">;
}

/** Common clone roots scanned under $HOME, plus the configured workspace dir. */
export const DEFAULT_SCAN_ROOTS = [
  "code",
  "projects",
  "src",
  "dev",
  "work",
] as const;

/** Never descended into during the local scan. */
export const PRUNE_DIR_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".venv",
  ".tox",
  "vendor",
  "target",
  "dist",
  "build",
]);

/** Repos are detected up to this many directory levels below a scan root. */
export const MAX_REPO_DEPTH = 3;

const SSH_RE = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/;
const HTTPS_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/;

/**
 * Parse a .git/config's origin remote into "owner/repo", or null when there
 * is no origin, its url is not a GitHub ssh/https form, or the file is
 * malformed. Only the `[remote "origin"]` section counts.
 */
export function extractOwnerRepo(gitConfigContent: string): string | null {
  let inOrigin = false;
  for (const line of gitConfigContent.split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("[")) {
      inOrigin = stripped.startsWith('[remote "origin"]');
      continue;
    }
    if (!inOrigin || !stripped.startsWith("url")) continue;
    const m = stripped.match(/^url\s*=\s*(.+)$/);
    if (m === null) continue;
    const url = m[1]!.trim();
    const hit = SSH_RE.exec(url) ?? HTTPS_RE.exec(url);
    return hit === null ? null : `${hit[1]}/${hit[2]}`;
  }
  return null;
}

/** Merge gh + local "owner/repo" hits: dedup, tag sources, sort alphabetically. */
export function mergeDiscovered(
  gh: readonly string[],
  local: readonly string[],
): DiscoveredRepo[] {
  const merged = new Map<string, Set<"gh" | "local">>();
  const add = (key: string, source: "gh" | "local"): void => {
    if (!key.includes("/")) return;
    const sources = merged.get(key) ?? new Set<"gh" | "local">();
    sources.add(source);
    merged.set(key, sources);
  };
  for (const key of gh) add(key, "gh");
  for (const key of local) add(key, "local");

  return [...merged.keys()].sort().map((key) => {
    const slash = key.indexOf("/");
    const sources = merged.get(key)!;
    return {
      owner: key.slice(0, slash),
      repo: key.slice(slash + 1),
      sources: (["gh", "local"] as const).filter((s) => sources.has(s)),
    };
  });
}
