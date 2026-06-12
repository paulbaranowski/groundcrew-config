import type { ConfigDraft } from "./types.ts";

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
  draft: ConfigDraft | Record<string, unknown>,
): Record<string, unknown> {
  const source = draft as Record<string, unknown>;
  const pruned = pruneValue(source) as Record<string, unknown>;
  if ("workspace" in source) {
    const workspace = isPlainObject(source.workspace) ? source.workspace : {};
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
  restoreAgentDefinitions(source, pruned);
  return pruned;
}

/**
 * An `agents.definitions[name] = {}` empty object enables a built-in agent — the
 * generic prune would drop it and leave `agents.default` dangling. Re-attach
 * any definition keys the prune removed so enable-markers survive.
 */
function restoreAgentDefinitions(
  draft: Record<string, unknown>,
  pruned: Record<string, unknown>,
): void {
  const agents = draft.agents;
  if (!isPlainObject(agents) || !isPlainObject(agents.definitions)) return;

  const prunedAgents = isPlainObject(pruned.agents) ? pruned.agents : {};
  const prunedDefinitions = isPlainObject(prunedAgents.definitions)
    ? prunedAgents.definitions
    : {};
  for (const [name, definition] of Object.entries(agents.definitions)) {
    if (!(name in prunedDefinitions)) {
      prunedDefinitions[name] = pruneValue(definition);
    }
  }
  prunedAgents.definitions = prunedDefinitions;
  pruned.agents = prunedAgents;
}
