import type { SectionId } from "./types.ts";

/**
 * Most-specific-first ordering: a longer key containing a shorter one MUST be
 * tested first (e.g. `workspaceKind` before `workspace` —
 * `"workspaceKind".includes("workspace")` is true; `defaults.hooks` before any
 * bare `hooks`).
 *
 * `usage` precedes `agents` on purpose: groundcrew has no top-level `usage`
 * key, but `agents.definitions.<name>.usage.*` contains both substrings.
 * Routing those errors to the Usage badge points the user at the screen where
 * the `usage.disabled` toggle lives.
 *
 * `orchestrator.sessionLimitPercentage` precedes bare `orchestrator` for the
 * same reason: that one field is edited on the Usage Limits screen even though
 * its config path is under orchestrator.
 */
export const SECTION_PREFIXES: Array<[string, SectionId]> = [
  ["knownRepositories", "repositories"],
  ["workspaceKind", "terminal"],
  ["defaults.hooks", "hooks"],
  ["workspace", "workspace"],
  ["usage", "usage"],
  ["orchestrator.sessionLimitPercentage", "usage"],
  ["agents", "agents"],
  ["linear", "taskSources"],
  ["sources", "taskSources"],
  ["orchestrator", "orchestrator"],
  ["git", "git"],
  ["local", "sandbox"],
  ["prompts", "prompts"],
  ["logging", "advanced"],
];

/**
 * Route a dotted key path (e.g. `workspace.projectDir`, `sources.0.enabled`)
 * to the owning `SectionId` via SECTION_PREFIXES. Shared by validity badge
 * routing (io/validate) and modified-marker routing (domain/modified) so both
 * draw from one table.
 */
export function sectionForKeyPath(keyPath: string): SectionId | undefined {
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (keyPath.includes(prefix)) return section;
  }
  return undefined;
}
