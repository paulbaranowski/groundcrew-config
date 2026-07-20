import type { KnownRepo } from "./types.ts";

/**
 * A repo's scripted provisioning templates. groundcrew requires *both* `create`
 * and `remove`; we keep them together so the editor round-trips them as a unit
 * and the loader reports a half-filled pair (rather than us silently dropping
 * one).
 */
export interface ProvisionEntry {
  create: string;
  remove: string;
}

export interface RepoEntry {
  name: string;
  projectDirOverride: string | undefined;
  /** Project subdirectory within the worktree (relative, no `..`). */
  workdir?: string | undefined;
  /** Scripted provisioning templates; mutually exclusive with `projectDirOverride`. */
  provision?: ProvisionEntry | undefined;
  /**
   * Per-repo `prepareWorktree` shell command (groundcrew ≥ 4.41). Slots
   * between a repo-committed `.groundcrew/config.json` hook (wins) and
   * `defaults.hooks.prepareWorktree` (fallback). Edited as a single string —
   * groundcrew's `HookCommands` only models one command today.
   */
  prepareWorktreeHook?: string | undefined;
  /**
   * Operator-only, per-repo host-side `prepareWorktree` shell command
   * (groundcrew ≥ 4.48). Runs on the host — outside the agent's sandbox —
   * before the sandboxed `hooks.prepareWorktree`, so repo setup that the
   * sandbox blocks (native compilation, host toolchains, writes outside the
   * worktree) can complete before the agent starts. Deliberately has no
   * `defaults.*` cascade: host execution is granted per repo, not fleet-wide,
   * and a repo-committed `.groundcrew/config.json` cannot grant itself host
   * execution.
   */
  unsandboxedPrepareWorktreeHook?: string | undefined;
}

type RepoUnion = string | KnownRepo;

export function normalizeRepos(
  repos: readonly RepoUnion[] | undefined,
): RepoEntry[] {
  return (repos ?? []).map((entry) =>
    typeof entry === "string"
      ? { name: entry, projectDirOverride: undefined }
      : {
          name: entry.name,
          projectDirOverride: entry.projectDirOverride,
          workdir: entry.workdir,
          provision: entry.provision
            ? { create: entry.provision.create, remove: entry.provision.remove }
            : undefined,
          prepareWorktreeHook: entry.hooks?.prepareWorktree,
          unsandboxedPrepareWorktreeHook:
            entry.unsandboxedHooks?.prepareWorktree,
        },
  );
}

export function denormalizeRepos(entries: readonly RepoEntry[]): RepoUnion[] {
  return entries.map((entry): RepoUnion => {
    const name = entry.name.trim();
    const override = entry.projectDirOverride?.trim();
    const workdir = entry.workdir?.trim();
    const create = entry.provision?.create.trim() ?? "";
    const remove = entry.provision?.remove.trim() ?? "";
    const prepareHook = entry.prepareWorktreeHook?.trim() ?? "";
    const unsandboxedHook =
      entry.unsandboxedPrepareWorktreeHook?.trim() ?? "";
    const hasOverride = override !== undefined && override.length > 0;
    const hasWorkdir = workdir !== undefined && workdir.length > 0;
    const hasProvision = create.length > 0 || remove.length > 0;
    const hasHook = prepareHook.length > 0;
    const hasUnsandboxedHook = unsandboxedHook.length > 0;
    // The bare string is the minimal form: emit it only when no per-repo option
    // is set, so an untouched repo never bloats into the object form.
    if (
      !hasOverride &&
      !hasWorkdir &&
      !hasProvision &&
      !hasHook &&
      !hasUnsandboxedHook
    ) {
      return name;
    }
    const repo: KnownRepo = { name };
    if (hasOverride) repo.projectDirOverride = override;
    if (hasWorkdir) repo.workdir = workdir;
    // Keep both keys even when one is blank: `pruneEmpty` strips the blank one
    // and groundcrew's loader then reports the both-required error against this
    // entry, instead of us silently discarding the half the user did type.
    if (hasProvision) repo.provision = { create, remove };
    if (hasHook) repo.hooks = { prepareWorktree: prepareHook };
    if (hasUnsandboxedHook) {
      repo.unsandboxedHooks = { prepareWorktree: unsandboxedHook };
    }
    return repo;
  });
}

/**
 * A repo name not already in `existing`: the base when free, otherwise the
 * first free `base-copy`, `base-copy-2`, `base-copy-3`, … so duplicating an
 * entry never collides with a sibling (which `repoErrors` would flag).
 */
export function uniqueRepoName(
  base: string,
  existing: readonly string[],
): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  const first = `${base}-copy`;
  if (!taken.has(first)) return first;
  for (let n = 2; ; n++) {
    const candidate = `${base}-copy-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A deep copy of `entry` (including its nested `provision` pair) under a name
 * unique against `existingNames`. The copy shares no mutable structure with the
 * source, so editing one in the sub-form never bleeds into the other.
 */
export function duplicateEntry(
  entry: RepoEntry,
  existingNames: readonly string[],
): RepoEntry {
  return {
    name: uniqueRepoName(entry.name, existingNames),
    projectDirOverride: entry.projectDirOverride,
    workdir: entry.workdir,
    provision: entry.provision
      ? { create: entry.provision.create, remove: entry.provision.remove }
      : undefined,
    prepareWorktreeHook: entry.prepareWorktreeHook,
    unsandboxedPrepareWorktreeHook: entry.unsandboxedPrepareWorktreeHook,
  };
}

/**
 * Per-entry error string (or undefined). Index-aligned with `entries`.
 * The first occurrence of a name is clean; only later repeats are flagged as
 * duplicates, so the user sees the error on the entry they just added.
 *
 * Mirrors the groundcrew rules the screen can check locally so its inline
 * feedback matches the Home badge (which comes from groundcrew's `loadConfig`).
 * A scripted (`provision`) entry has no groundcrew-managed clone, so pairing it
 * with `projectDirOverride` is rejected — surface that here rather than only on
 * Home. (A half-filled `provision` is intentionally left to groundcrew; see
 * `denormalizeRepos`.)
 */
export function repoErrors(
  entries: readonly RepoEntry[],
): Array<string | undefined> {
  const seen = new Set<string>();
  return entries.map((entry) => {
    const name = entry.name.trim();
    if (name.length === 0) return "name is required";
    const duplicate = seen.has(name);
    seen.add(name);
    if (duplicate) return "duplicate repository name";
    const hasOverride = (entry.projectDirOverride?.trim().length ?? 0) > 0;
    const hasProvision =
      (entry.provision?.create.trim().length ?? 0) > 0 ||
      (entry.provision?.remove.trim().length ?? 0) > 0;
    if (hasOverride && hasProvision) {
      return "projectDirOverride can't be combined with provision";
    }
    return undefined;
  });
}
