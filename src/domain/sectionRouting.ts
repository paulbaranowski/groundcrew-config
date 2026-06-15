import type { SectionId } from "./types.ts";

/**
 * Order is load-bearing only where two prefixes can both segment-match the same
 * key path; everywhere else the grouping below is just for legibility.
 *
 * Required orderings (don't reshuffle without re-checking):
 *
 *   `usage` before `agents` — `agents.definitions.<name>.usage.*` keys must
 *     route to the Usage badge (the screen that owns `usage.disabled`), not to
 *     Agents. Both prefixes segment-match these paths; first match wins.
 *
 *   `orchestrator.sessionLimitPercentage` before `orchestrator` — that one
 *     field is edited on the Usage Limits screen even though its config path
 *     lives under orchestrator.
 *
 * Other entries that happen to share a starting substring (e.g. `workspaceKind`
 * vs `workspace`) are independent under the new segment-boundary matcher and
 * their relative order does not matter.
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
 *
 * Matches a prefix anywhere in the path on segment boundaries — i.e. the prefix
 * must abut either the start of the path or a `.`/`[`, and must end at the
 * path end or a `.`/`[`. This catches both top-level keys (`workspace.foo`) and
 * nested ones (`agents.definitions.claude.usage.foo` matches the `usage` row),
 * while rejecting substring false positives like `linear` matching
 * `defaultLinearFoo` or `git` matching `agents.definitions.foo.gitConfig`.
 */
export function sectionForKeyPath(keyPath: string): SectionId | undefined {
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (containsSegment(keyPath, prefix)) return section;
  }
  return undefined;
}

function containsSegment(path: string, segment: string): boolean {
  if (segment.length > path.length) return false;
  let from = 0;
  while (from <= path.length - segment.length) {
    const idx = path.indexOf(segment, from);
    if (idx === -1) return false;
    const before = idx === 0 ? "." : path[idx - 1];
    const after = idx + segment.length === path.length ? "." : path[idx + segment.length];
    if ((before === "." || before === "[") && (after === "." || after === "[")) {
      return true;
    }
    from = idx + 1;
  }
  return false;
}
