import type { ConfigDraft } from "./types.ts";

type Models = ConfigDraft["models"];
type Def = Record<string, unknown>;

// groundcrew's built-in `claude` preset cmd. An empty `claude: {}` entry inherits
// this, so the toggle treats a missing cmd as "claude in auto mode".
const CLAUDE_DEFAULT_CMD = "claude --permission-mode auto";

/** The def's effective cmd: its own `cmd`, or the built-in default for `claude`. */
function effectiveCmd(name: string, def: Def): string | undefined {
  const cmd = def.cmd;
  if (typeof cmd === "string" && cmd.length > 0) return cmd;
  if (name === "claude") return CLAUDE_DEFAULT_CMD;
  return undefined;
}

/** Basename of a cmd's first token, ignoring any leading path (`/usr/bin/claude`). */
function agentBinary(cmd: string): string {
  const first = cmd.trim().split(/\s+/)[0] ?? "";
  return first.split("/").pop() ?? first;
}

/**
 * Strip every existing `--permission-mode <value>` (or `=value`) flag, then
 * append the desired one. Stripping all occurrences keeps the toggle honest
 * even when a raw-JSON edit left duplicate flags (a later one would win).
 */
function applyPermissionMode(cmd: string, mode: string): string {
  const stripped = cmd
    .replace(/--permission-mode(?:=|\s+)\S+/g, "")
    .trim()
    .replace(/\s{2,}/g, " ");
  return `${stripped} --permission-mode ${mode}`.trim();
}

/** True when this model launches the `claude` binary (the only agent we toggle). */
export function isClaudeModel(name: string, def: unknown): boolean {
  const cmd = effectiveCmd(name, (def ?? {}) as Def);
  return cmd !== undefined && agentBinary(cmd) === "claude";
}

/** True when the model's effective cmd runs Claude in bypassPermissions mode. */
export function isBypassEnabled(name: string, def: unknown): boolean {
  const cmd = effectiveCmd(name, (def ?? {}) as Def);
  if (cmd === undefined) return false;
  return /--permission-mode\s+bypassPermissions\b/.test(cmd);
}

/** Toggle bypassPermissions on one model by rewriting its cmd's permission mode. */
export function setBypass(
  models: Models,
  name: string,
  enabled: boolean,
): Models {
  const definitions = { ...(models?.definitions ?? {}) } as Record<string, Def>;
  const def = { ...(definitions[name] ?? {}) };
  const base = effectiveCmd(name, def) ?? CLAUDE_DEFAULT_CMD;
  const mode = enabled ? "bypassPermissions" : "auto";
  def.cmd = applyPermissionMode(base, mode);
  definitions[name] = def;
  return { ...models, definitions } as Models;
}
