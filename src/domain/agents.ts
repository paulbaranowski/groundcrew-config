import { isObject } from "./guards.ts";
import type { ConfigDraft } from "./types.ts";

type Agents = ConfigDraft["agents"];
/** A single agent definition entry, exactly groundcrew's user-facing shape. */
export type AgentDef = NonNullable<NonNullable<Agents>["definitions"]>[string];
type Def = AgentDef;

/** Built-in agent presets, in display order. An empty `{}` entry enables one. */
export const BUILTIN_AGENTS = ["claude", "codex", "cursor"] as const;

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

/** The raw definition object for `name` (an empty object when none exists). */
export function getAgentDef(agents: Agents, name: string): Def {
  const def = (agents?.definitions ?? {})[name];
  // Exclude arrays — `typeof [] === "object"` — so a stray array from a raw-JSON
  // edit can't leak through as a definition.
  return isObject(def) ? (def as Def) : {};
}

/** Replace `name`'s definition, enabling it if it was absent. */
export function setAgentDef(agents: Agents, name: string, def: Def): Agents {
  const definitions = { ...(agents?.definitions ?? {}) } as Record<string, Def>;
  definitions[name] = def;
  return { ...agents, definitions } as Agents;
}

/** The per-agent detail fields the AgentSubForm edits, as plain strings. */
export interface AgentFields {
  cmd: string;
  color: string;
  preLaunch: string;
  /** Env var names to forward into the agent, one per entry. */
  preLaunchEnv: string[];
  /** The sbx agent name bound under `sandbox.agent`. */
  sandboxAgent: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read an agent definition into editable string fields for the sub-form. */
export function readAgentFields(def: Def): AgentFields {
  const sandbox = def.sandbox as { agent?: unknown } | undefined;
  const env = Array.isArray(def.preLaunchEnv)
    ? def.preLaunchEnv.filter((n): n is string => typeof n === "string")
    : [];
  return {
    cmd: asString(def.cmd),
    color: asString(def.color),
    preLaunch: asString(def.preLaunch),
    preLaunchEnv: env,
    sandboxAgent: asString(sandbox?.agent),
  };
}

/**
 * Merge edited fields back into a definition. Empty strings clear the key;
 * `preLaunchEnv` trims each entry and drops blanks (empty list clears the key);
 * `sandboxAgent` nests under `sandbox.agent` (clearing it drops the whole
 * `sandbox` block, whose only field is `agent`).
 */
export function applyAgentFields(def: Def, fields: AgentFields): Def {
  const next = { ...def };
  for (const key of ["cmd", "color", "preLaunch"] as const) {
    if (fields[key].length === 0) delete next[key];
    else next[key] = fields[key];
  }
  const env = fields.preLaunchEnv
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (env.length === 0) delete next.preLaunchEnv;
  else next.preLaunchEnv = env;
  const sandboxAgent = fields.sandboxAgent.trim();
  if (sandboxAgent.length === 0) delete next.sandbox;
  else next.sandbox = { agent: sandboxAgent };
  return next;
}

/**
 * True when the resolved runner makes `sandbox.agent` mandatory. groundcrew
 * requires it whenever the runner resolves to `sdx` — explicitly, or via
 * `auto` on Linux. Used to warn before the validator rejects the config.
 */
export function runnerRequiresSandbox(
  runner: string | undefined,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (runner === "sdx") return true;
  return (runner === undefined || runner === "auto") && platform === "linux";
}
