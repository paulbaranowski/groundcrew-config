function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function pruneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneValue).filter((v) => !isEmpty(v));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const pruned = pruneValue(raw);
      if (!isEmpty(pruned)) out[key] = pruned;
    }
    return out;
  }
  return value;
}

/**
 * Recursively drop empty values, but always retain the top-level `workspace`
 * key. `workspace.knownRepositories` is a required field, so it is kept even
 * when empty (an absent `knownRepositories` is not synthesized).
 */
export function pruneEmpty(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const pruned = pruneValue(draft) as Record<string, unknown>;
  if ("workspace" in draft) {
    const workspace = isPlainObject(draft.workspace) ? draft.workspace : {};
    const prunedWorkspace = pruneValue(workspace) as Record<string, unknown>;
    if (
      "knownRepositories" in workspace &&
      !("knownRepositories" in prunedWorkspace)
    ) {
      prunedWorkspace.knownRepositories = pruneValue(
        workspace.knownRepositories,
      );
    }
    pruned.workspace = prunedWorkspace;
  }
  return pruned;
}
