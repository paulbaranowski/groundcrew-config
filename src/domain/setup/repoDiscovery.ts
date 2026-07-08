// Pure half of repo discovery (F6): origin-URL parsing, .git/config parsing,
// and the gh+local merge that feeds the discovery picker.

/** One mergeable discovery hit, tagged by where it was found (F6). */
export interface DiscoveredRepo {
  owner: string;
  repo: string;
  /**
   * The name committed into workspace.knownRepositories: the on-disk folder
   * name for a locally-cloned hit (which may differ from `repo` for a fork or
   * a renamed clone), falling back to `repo` for a gh-only hit that is not on
   * disk. groundcrew resolves knownRepositories by this folder name.
   */
  name: string;
  sources: Array<"gh" | "local">;
}

/** A local clone hit: its origin slug (for dedup) plus its on-disk folder name. */
export interface LocalHit {
  ownerRepo: string;
  name: string;
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
    // A remote may carry multiple url lines; a non-GitHub one (e.g. a push
    // mirror) shouldn't shadow a later GitHub url, so keep scanning on a miss.
    if (hit !== null) return `${hit[1]}/${hit[2]}`;
  }
  return null;
}

/**
 * Merge gh "owner/repo" slugs with local clone hits: dedup by slug, tag
 * sources, sort alphabetically. The committed `name` is the local folder name
 * when the repo was found on disk (authoritative - it is what exists under
 * projectDir), falling back to the repo slug for a gh-only hit.
 */
export function mergeDiscovered(
  gh: readonly string[],
  local: readonly LocalHit[],
): DiscoveredRepo[] {
  interface Entry {
    sources: Set<"gh" | "local">;
    localName?: string;
  }
  const merged = new Map<string, Entry>();
  const ensure = (key: string): Entry => {
    let entry = merged.get(key);
    if (entry === undefined) {
      entry = { sources: new Set<"gh" | "local">() };
      merged.set(key, entry);
    }
    return entry;
  };
  for (const key of gh) {
    if (!key.includes("/")) continue;
    ensure(key).sources.add("gh");
  }
  for (const hit of local) {
    if (!hit.ownerRepo.includes("/")) continue;
    const entry = ensure(hit.ownerRepo);
    entry.sources.add("local");
    entry.localName = hit.name;
  }

  return [...merged.keys()].sort().map((key) => {
    const slash = key.indexOf("/");
    const repo = key.slice(slash + 1);
    const entry = merged.get(key)!;
    return {
      owner: key.slice(0, slash),
      repo,
      name: entry.localName ?? repo,
      sources: (["gh", "local"] as const).filter((s) => entry.sources.has(s)),
    };
  });
}
