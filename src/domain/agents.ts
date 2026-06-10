import type { ConfigDraft } from "./types.ts";

type Agents = ConfigDraft["agents"];
type Def = Record<string, unknown>;

/** Built-in agent presets, in display order. An empty `{}` entry enables one. */
export const BUILTIN_AGENTS = ["claude", "codex"] as const;

/** True when `name` has a definition entry (i.e. the agent is enabled). */
export function isAgentEnabled(agents: Agents, name: string): boolean {
  return Object.hasOwn(agents?.definitions ?? {}, name);
}

/**
 * Enable or disable an agent. Enabling adds an empty `{}` (which inherits the
 * built-in preset) only when absent — an existing entry is left untouched.
 * Disabling deletes the entry. `agents.default` is never changed.
 */
export function setAgentEnabled(
  agents: Agents,
  name: string,
  enabled: boolean,
): Agents {
  const definitions = { ...(agents?.definitions ?? {}) } as Record<string, Def>;
  if (enabled) {
    if (!(name in definitions)) definitions[name] = {};
  } else {
    delete definitions[name];
  }
  return { ...agents, definitions } as Agents;
}
