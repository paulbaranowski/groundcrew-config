// Immutable dotted-path get/set into the draft — the store/clear primitive
// behind every FieldSpec. `getByPath` reads a leaf value (or undefined if any
// segment is absent); `setByPath` writes one without mutating its input.

import { isObject } from "./guards.ts";

export function getByPath(draft: unknown, path: string): unknown {
  let current: unknown = draft;
  for (const key of path.split(".")) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Returns a shallow-cloned draft with `value` stored at the dotted `path`.
 * Intermediate objects along the path are created on demand when missing.
 * Passing `value === undefined` deletes the leaf key — the clear-a-field idiom
 * (a blanked-out field stores nothing rather than an empty value).
 */
export function setByPath<T extends Record<string, unknown>>(
  draft: T,
  path: string,
  value: unknown,
): T {
  const keys = path.split(".");
  const [head, ...rest] = keys;
  if (head === undefined) return draft;
  const clone: Record<string, unknown> = { ...draft };
  if (rest.length === 0) {
    if (value === undefined) delete clone[head];
    else clone[head] = value;
  } else {
    const child = isObject(clone[head])
      ? (clone[head] as Record<string, unknown>)
      : {};
    clone[head] = setByPath(child, rest.join("."), value);
  }
  return clone as T;
}
