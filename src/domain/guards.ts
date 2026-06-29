/**
 * Shared structural type guard for plain-object values across the domain layer.
 * `isObject` narrows to `Record<string, unknown>` only for a non-null,
 * non-array `object` — `typeof null === "object"` and arrays are objects too,
 * so both are excluded. This is the canonical predicate behind path traversal,
 * the save-time prune, and the agent-definition guard.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
