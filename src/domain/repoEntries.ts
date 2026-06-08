import type { ConfigDraft, KnownRepo } from "./types.ts";

export interface RepoEntry {
  name: string;
  projectDirOverride: string | undefined;
}

type RepoUnion = ConfigDraft["workspace"]["knownRepositories"][number];

export function normalizeRepos(
  repos: readonly RepoUnion[] | undefined,
): RepoEntry[] {
  return (repos ?? []).map((entry) =>
    typeof entry === "string"
      ? { name: entry, projectDirOverride: undefined }
      : { name: entry.name, projectDirOverride: entry.projectDirOverride },
  );
}

export function denormalizeRepos(entries: readonly RepoEntry[]): RepoUnion[] {
  return entries.map((entry): RepoUnion => {
    if (
      entry.projectDirOverride === undefined ||
      entry.projectDirOverride.length === 0
    ) {
      return entry.name;
    }
    const repo: KnownRepo = {
      name: entry.name,
      projectDirOverride: entry.projectDirOverride,
    };
    return repo;
  });
}

/**
 * Per-entry error string (or undefined). Index-aligned with `entries`.
 * The first occurrence of a name is clean; only later repeats are flagged as
 * duplicates, so the user sees the error on the entry they just added.
 */
export function repoErrors(
  entries: readonly RepoEntry[],
): Array<string | undefined> {
  const seen = new Set<string>();
  return entries.map((entry) => {
    if (entry.name.trim().length === 0) return "name is required";
    if (seen.has(entry.name)) return "duplicate repository name";
    seen.add(entry.name);
    return undefined;
  });
}
