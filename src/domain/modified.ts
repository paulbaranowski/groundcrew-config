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
 *
 * `keyOf` receives the item's index so callers can disambiguate colliding
 * synthetic keys — e.g. a list whose user-typed key is sometimes blank can use
 * `(item, i) => item.key || \`__blank__${i}\`` to force positional matching
 * for the blanks while still keying named entries by their key (so reorders
 * are still detected as equal).
 */
export function modifiedByKey<T>(
  current: readonly T[],
  baseline: readonly T[] | undefined,
  keyOf: (item: T, index: number) => string,
): boolean[] {
  if (baseline === undefined) return current.map(() => true);
  const byKey = new Map<string, T>();
  baseline.forEach((item, i) => byKey.set(keyOf(item, i), item));
  return current.map((item, i) => {
    const match = byKey.get(keyOf(item, i));
    return match === undefined || !valuesEqual(item, match);
  });
}
