import type { ConfigDraft } from "./types.ts";

type Source = NonNullable<ConfigDraft["sources"]>[number];
export type TodoTxtField =
  | "todoPath"
  | "tasksDir"
  | "defaultRepository"
  | "idPrefix"
  | "timezone";

const PLAN_KEEPER_NAME = "plankeeper";

function sourceName(source: Source): string {
  return (source as { name?: string }).name ?? source.kind;
}

function isDisabled(source: Source): boolean {
  return (source as { enabled?: boolean }).enabled === false;
}

function isLinearKind(source: Source): boolean {
  return source.kind === "linear";
}

function isTodoTxtKind(source: Source): boolean {
  return source.kind === "todo-txt";
}

function isShellKind(source: Source): boolean {
  return source.kind === "shell";
}

function isPlanKeeper(source: Source): boolean {
  return isShellKind(source) && sourceName(source) === PLAN_KEEPER_NAME;
}

/** A generic shell source — any `kind:"shell"` entry other than the PlanKeeper preset. */
function isGenericShell(source: Source): boolean {
  return isShellKind(source) && !isPlanKeeper(source);
}

/**
 * True for any source the TUI manages with its own screen: Linear, todo-txt,
 * PlanKeeper, and generic shell sources (all `kind:"shell"`). The raw-JSON
 * "Custom" bucket is left for any other (e.g. future) source kinds.
 */
function isManaged(source: Source): boolean {
  return isLinearKind(source) || isTodoTxtKind(source) || isShellKind(source);
}

export function planKeeperSource(): Source {
  return {
    kind: "shell",
    name: PLAN_KEEPER_NAME,
    commands: {
      verify: "plan-keeper crew fetch >/dev/null",
      fetch: "plan-keeper crew fetch",
      resolveOne: "plan-keeper crew get ${id}",
      markInProgress: "plan-keeper crew start ${id}",
      markInReview: "plan-keeper crew review ${id}",
    },
  } as unknown as Source;
}

export function todoTxtSource(): Source {
  return { kind: "todo-txt" } as unknown as Source;
}

// Linear (4.24: no longer implicit — enabled only when an enabled
// {kind:"linear"} entry exists; absence means off).
export function isLinearEnabled(draft: ConfigDraft): boolean {
  return (draft.sources ?? []).some((s) => isLinearKind(s) && !isDisabled(s));
}

export function setLinearEnabled(
  draft: ConfigDraft,
  enabled: boolean,
): ConfigDraft {
  const others = (draft.sources ?? []).filter((s) => !isLinearKind(s));
  const sources = enabled
    ? [...others, { kind: "linear" } as unknown as Source]
    : others;
  return { ...draft, sources };
}

/** Plain string fields editable on the Linear source entry. */
export type LinearField = "name" | "team";
/** The two overridable canonical-status mappings (each an array of names). */
export type LinearStatusField = "inProgress" | "inReview";

function findLinear(draft: ConfigDraft): Source | undefined {
  return (draft.sources ?? []).find(isLinearKind);
}

export function getLinearField(
  draft: ConfigDraft,
  field: LinearField,
): string | undefined {
  const entry = findLinear(draft);
  const value =
    entry === undefined ? undefined : (entry as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

export function setLinearField(
  draft: ConfigDraft,
  field: LinearField,
  value: string,
): ConfigDraft {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isLinearKind(s)) return s;
    const next = { ...(s as Record<string, unknown>) };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next as unknown as Source;
  });
  return { ...draft, sources };
}

/**
 * The comma-joined status names for one canonical mapping, for display in a
 * single text field. Empty string when the override is unset.
 */
export function getLinearStatuses(
  draft: ConfigDraft,
  field: LinearStatusField,
): string {
  const entry = findLinear(draft);
  const statuses = (entry as { statuses?: Record<string, unknown> } | undefined)
    ?.statuses;
  const names = statuses?.[field];
  return Array.isArray(names)
    ? names.filter((n): n is string => typeof n === "string").join(", ")
    : "";
}

/**
 * Parse a comma-separated list of Linear status names into the `statuses.<field>`
 * array. Blank entries are dropped; an all-blank value removes the override (and
 * the whole `statuses` object once both mappings are gone), since groundcrew
 * requires at least one name per declared mapping.
 */
export function setLinearStatuses(
  draft: ConfigDraft,
  field: LinearStatusField,
  value: string,
): ConfigDraft {
  const names = value
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  const sources = (draft.sources ?? []).map((s) => {
    if (!isLinearKind(s)) return s;
    const next = { ...(s as Record<string, unknown>) };
    const statuses = { ...((next.statuses as Record<string, unknown>) ?? {}) };
    if (names.length === 0) delete statuses[field];
    else statuses[field] = names;
    if (Object.keys(statuses).length === 0) delete next.statuses;
    else next.statuses = statuses;
    return next as unknown as Source;
  });
  return { ...draft, sources };
}

// todo-txt
export function isTodoTxtEnabled(draft: ConfigDraft): boolean {
  return (draft.sources ?? []).some((s) => isTodoTxtKind(s) && !isDisabled(s));
}

export function setTodoTxtEnabled(
  draft: ConfigDraft,
  enabled: boolean,
): ConfigDraft {
  const others = (draft.sources ?? []).filter((s) => !isTodoTxtKind(s));
  const sources = enabled ? [...others, todoTxtSource()] : others;
  return { ...draft, sources };
}

export function getTodoTxtField(
  draft: ConfigDraft,
  field: TodoTxtField,
): string | undefined {
  const entry = (draft.sources ?? []).find(isTodoTxtKind);
  const value =
    entry === undefined ? undefined : (entry as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

export function setTodoTxtField(
  draft: ConfigDraft,
  field: TodoTxtField,
  value: string,
): ConfigDraft {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isTodoTxtKind(s)) return s;
    const next = { ...(s as Record<string, unknown>) };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next as unknown as Source;
  });
  return { ...draft, sources };
}

// PlanKeeper
export function isPlanKeeperEnabled(draft: ConfigDraft): boolean {
  return (draft.sources ?? []).some(isPlanKeeper);
}

export function setPlanKeeperEnabled(
  draft: ConfigDraft,
  enabled: boolean,
): ConfigDraft {
  const others = (draft.sources ?? []).filter((s) => !isPlanKeeper(s));
  const sources = enabled ? [...others, planKeeperSource()] : others;
  return { ...draft, sources };
}

/**
 * The integration commands wired up on the live plan-keeper entry (verify,
 * fetch, resolveOne, …), as ordered [name, command] pairs — or undefined when
 * plan-keeper isn't configured. Reads the actual entry so absolute paths and
 * manual edits show through in the PlanKeeper screen.
 */
export function planKeeperCommands(
  draft: ConfigDraft,
): Array<[string, string]> | undefined {
  const entry = (draft.sources ?? []).find(isPlanKeeper);
  const commands = (entry as { commands?: unknown })?.commands;
  // typeof null === "object", so guard null explicitly before Object.entries.
  if (commands === null || typeof commands !== "object") return undefined;
  return Object.entries(commands as Record<string, unknown>).filter(
    (pair): pair is [string, string] => typeof pair[1] === "string",
  );
}

/** Sources crew would actually run (anything not opted out with enabled:false). */
export function enabledSourceCount(draft: ConfigDraft): number {
  return (draft.sources ?? []).filter((s) => !isDisabled(s)).length;
}

// Generic shell sources (Jira, etc.) — every kind:"shell" entry except the
// dedicated PlanKeeper preset, edited through the guided shell builder.

/** The shell lifecycle commands the builder edits, in display order. */
export const SHELL_COMMAND_FIELDS = [
  "verify",
  "validate",
  "listTasks",
  "getTask",
  "createTask",
  "markInProgress",
  "markInReview",
  "markDone",
] as const;
type ShellCommandField = (typeof SHELL_COMMAND_FIELDS)[number];

/**
 * One environment-variable assignment passed to every command for a shell
 * source. Modelled as an ordered list (not a `Record`) so the editor keeps a
 * stable row order and can hold a half-typed entry whose key is still blank.
 */
export interface EnvEntry {
  key: string;
  value: string;
}

/** The shell source builder's editable string fields. */
export type ShellTextField = ShellCommandField | "name" | "cwd";

/** The shell source builder's editable fields: plain strings plus the env list. */
export interface ShellFields extends Record<ShellCommandField, string> {
  name: string;
  cwd: string;
  env: EnvEntry[];
}

export function shellSources(draft: ConfigDraft): Source[] {
  return (draft.sources ?? []).filter(isGenericShell);
}

export function shellSourceCount(draft: ConfigDraft): number {
  return shellSources(draft).length;
}

/**
 * Display names of the generic shell sources, in order — what the Home summary
 * shows instead of a bare count. A blank/missing name falls back to "shell".
 */
export function shellSourceNames(draft: ConfigDraft): string[] {
  return shellSources(draft).map((s) => {
    const name = (s as { name?: string }).name;
    return name !== undefined && name.trim().length > 0 ? name : "shell";
  });
}

/**
 * Replace the generic shell sources, preserving every other entry (linear,
 * todo-txt, plan-keeper, unknown kinds). The dedicated screens keep ownership
 * of their own entries.
 */
export function setShellSources(
  draft: ConfigDraft,
  entries: readonly Source[],
): ConfigDraft {
  const others = (draft.sources ?? []).filter((s) => !isGenericShell(s));
  return { ...draft, sources: [...others, ...entries.filter(isGenericShell)] };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Read a shell source's `env` map into the editor's ordered entry list. groundcrew
 * types `env` as `Record<string,string>`; non-string values (or a non-object) are
 * dropped rather than coerced.
 */
export function readShellEnv(source: Source | undefined): EnvEntry[] {
  const raw = (source as { env?: unknown } | undefined)?.env;
  // typeof null === "object", so guard null explicitly before Object.entries.
  if (raw === null || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter((pair): pair is [string, string] => typeof pair[1] === "string")
    .map(([key, value]) => ({ key, value }));
}

/**
 * Flatten a shell source into the builder's editable fields. The preferred
 * command names win, falling back to the legacy `fetch`/`resolveOne` aliases;
 * `env` is read into an ordered entry list.
 */
export function readShellFields(source: Source | undefined): ShellFields {
  const s = (source ?? {}) as Record<string, unknown>;
  const c = (s.commands as Record<string, unknown>) ?? {};
  return {
    name: asString(s.name),
    verify: asString(c.verify),
    validate: asString(c.validate),
    listTasks: asString(c.listTasks) || asString(c.fetch),
    getTask: asString(c.getTask) || asString(c.resolveOne),
    createTask: asString(c.createTask),
    markInProgress: asString(c.markInProgress),
    markInReview: asString(c.markInReview),
    markDone: asString(c.markDone),
    cwd: asString(s.cwd),
    env: readShellEnv(source),
  };
}

/**
 * Build a shell source from edited fields, merged onto `base` so unmanaged keys
 * (e.g. timeouts) survive an edit. The builder writes the preferred command
 * names and drops the legacy `fetch`/`resolveOne` aliases to avoid ambiguity.
 * `env` is rebuilt from `fields.env`: entries with a blank key are dropped, a
 * later entry wins on a duplicate key, and an empty map removes the `env` key.
 */
export function applyShellFields(
  base: Source | undefined,
  fields: ShellFields,
): Source {
  const src = { ...((base ?? {}) as Record<string, unknown>) };
  src.kind = "shell";
  src.name = fields.name.trim();
  const commands = { ...((src.commands as Record<string, unknown>) ?? {}) };
  delete commands.fetch;
  delete commands.resolveOne;
  for (const key of SHELL_COMMAND_FIELDS) {
    if (fields[key].length === 0) delete commands[key];
    else commands[key] = fields[key];
  }
  src.commands = commands;
  if (fields.cwd.trim().length === 0) delete src.cwd;
  else src.cwd = fields.cwd;
  const env: Record<string, string> = {};
  for (const entry of fields.env) {
    const key = entry.key.trim();
    if (key.length > 0) env[key] = entry.value;
  }
  if (Object.keys(env).length === 0) delete src.env;
  else src.env = env;
  return src as unknown as Source;
}

/** Sources with no managed screen (not linear / todo-txt / plan-keeper). */
export function customSources(draft: ConfigDraft): Source[] {
  return (draft.sources ?? []).filter((s) => !isManaged(s));
}

export function customSourceCount(draft: ConfigDraft): number {
  return customSources(draft).length;
}
