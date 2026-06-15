import { changedPaths, valuesEqual } from "./diff.ts";
import { sectionForKeyPath } from "./sectionRouting.ts";
import type { ConfigDraft, SectionId } from "./types.ts";

/**
 * The set of sections whose owned slice of the draft differs from `baseline`.
 * Routes each entry of `changedPaths(baseline, draft)` through the shared
 * `sectionForKeyPath` table; paths that route nowhere are silently ignored
 * (every modelled config key is covered by SECTION_PREFIXES).
 */
export function modifiedSections(
  baseline: ConfigDraft,
  draft: ConfigDraft,
): Set<SectionId> {
  const out = new Set<SectionId>();
  for (const path of changedPaths(baseline, draft)) {
    const section = sectionForKeyPath(path);
    if (section !== undefined) out.add(section);
  }
  return out;
}

/**
 * Index-aligned per-item modified flags for a list. An item is modified when
 * no baseline item shares its key (new or renamed) or when the matched baseline
 * item is not deep-equal. `baseline` undefined means every item is modified.
 */
export function modifiedByKey<T>(
  current: readonly T[],
  baseline: readonly T[] | undefined,
  keyOf: (item: T) => string,
): boolean[] {
  if (baseline === undefined) return current.map(() => true);
  const byKey = new Map<string, T>();
  for (const item of baseline) byKey.set(keyOf(item), item);
  return current.map((item) => {
    const match = byKey.get(keyOf(item));
    return match === undefined || !valuesEqual(item, match);
  });
}
