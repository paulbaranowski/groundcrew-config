/**
 * Save-time minimizer: drops empty values so the written `crew.config.json`
 * stays minimal. Empty means undefined, an empty string, an empty array, or an
 * empty plain object (see `isEmpty`).
 *
 * Some fields are meaningful precisely _when_ empty and must survive the prune.
 * Any new such field must be taught to this module — the generic prune does not
 * know which empties carry meaning. The current exceptions:
 *  - top-level `workspace` is always retained.
 *  - `workspace.knownRepositories` is required, so it is kept even when empty
 *    (an absent `knownRepositories` is not synthesized).
 *  - `agents.definitions[name] = {}` is the enable-marker for a built-in agent;
 *    an empty definition still enables it.
 *
 * `pruneEmpty` is the only sanctioned entry point. It runs the generic
 * `pruneValue` first, then `restoreAgentDefinitions` re-attaches the dropped
 * enable-markers, mutating the pruned object in place. Replacing `pruneEmpty`
 * with a bare `pruneValue(draft)` would drop those enable-markers and leave
 * `agents.default` dangling.
 */
import { isObject } from "./guards.ts";
import type { ConfigDraft } from "./types.ts";

function isEmpty(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}

function pruneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneValue).filter((v) => !isEmpty(v));
  }
  if (isObject(value)) {
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
    const workspace = isObject(source.workspace) ? source.workspace : {};
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
  if (!isObject(agents) || !isObject(agents.definitions)) return;

  const prunedAgents = isObject(pruned.agents) ? pruned.agents : {};
  const prunedDefinitions = isObject(prunedAgents.definitions)
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
