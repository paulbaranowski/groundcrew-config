import { valuesEqual } from "./diff.ts";
import type { ConfigDraft } from "./types.ts";

/**
 * Task sources are matched structurally, not by a flag: a source's identity is
 * read off its `kind`, optional `name`, and `enabled !== false` shape. This
 * module owns the linear / todo-txt / plan-keeper / generic-shell entries and
 * edits them through `kind`-narrowing against groundcrew's real discriminated
 * union; any other (unknown) kind is preserved untouched on save.
 */

type Source = NonNullable<ConfigDraft["sources"]>[number];

/** The `{ kind: "linear" }` member of groundcrew's source union. */
type LinearSource = Extract<Source, { kind: "linear" }>;
/** The `{ kind: "todo-txt" }` member of groundcrew's source union. */
type TodoTxtSource = Extract<Source, { kind: "todo-txt" }>;
/** The `{ kind: "shell" }` member of groundcrew's source union. */
export type ShellSource = Extract<Source, { kind: "shell" }>;

/**
 * The fields every source shares structurally regardless of kind. `name` and
 * `enabled` are read through this so the kind/name/`enabled !== false` matching
 * stays in one place instead of being re-asserted ad hoc at each call site.
 */
interface SourceCommon {
  kind: string;
  name?: string;
  enabled?: boolean;
}

export type TodoTxtField =
  | "todoPath"
  | "tasksDir"
  | "defaultRepository"
  | "idPrefix"
  | "timezone";

const PLAN_KEEPER_NAME = "plankeeper";

function sourceName(source: Source): string {
  return (source as SourceCommon).name ?? source.kind;
}

function isDisabled(source: Source): boolean {
  return (source as SourceCommon).enabled === false;
}

function isLinearKind(source: Source): source is LinearSource {
  return source.kind === "linear";
}

function isTodoTxtKind(source: Source): source is TodoTxtSource {
  return source.kind === "todo-txt";
}

function isShellKind(source: Source): source is ShellSource {
  return source.kind === "shell";
}

function isPlanKeeper(source: Source): source is ShellSource {
  return isShellKind(source) && sourceName(source) === PLAN_KEEPER_NAME;
}

/** A generic shell source — any `kind:"shell"` entry other than the PlanKeeper preset. */
function isGenericShell(source: Source): source is ShellSource {
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

export function planKeeperSource(): ShellSource {
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
  };
}

/**
 * The loose, user-facing todo-txt entry. groundcrew's exported union types the
 * defaulted fields (name/todoPath/tasksDir/idPrefix/timezone) as required —
 * their values are filled at load time — so the bare `{ kind: "todo-txt" }` the
 * TUI writes is declared against this optional-field shape rather than the
 * post-default union member.
 */
interface TodoTxtSourceInput {
  kind: "todo-txt";
  name?: string;
  todoPath?: string;
  tasksDir?: string;
  defaultRepository?: string;
  idPrefix?: string;
  timezone?: string;
}

export function todoTxtSource(): TodoTxtSourceInput {
  return { kind: "todo-txt" };
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
    ? [...others, { kind: "linear" } satisfies LinearSource]
    : others;
  return { ...draft, sources };
}

/** Plain string fields editable on the Linear source entry. */
export type LinearField = "name" | "team";
/** The two overridable canonical-status mappings (each an array of names). */
export type LinearStatusField = "inProgress" | "inReview";

function findLinear(draft: ConfigDraft): LinearSource | undefined {
  return (draft.sources ?? []).find(isLinearKind);
}

export function getLinearField(
  draft: ConfigDraft,
  field: LinearField,
): string | undefined {
  const value = findLinear(draft)?.[field];
  return typeof value === "string" ? value : undefined;
}

export function setLinearField(
  draft: ConfigDraft,
  field: LinearField,
  value: string,
): ConfigDraft {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isLinearKind(s)) return s;
    const next: LinearSource = { ...s };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next;
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
  const names = findLinear(draft)?.statuses?.[field];
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
    const next: LinearSource = { ...s };
    const statuses = { ...(next.statuses ?? {}) };
    if (names.length === 0) delete statuses[field];
    else statuses[field] = names;
    if (Object.keys(statuses).length === 0) delete next.statuses;
    else next.statuses = statuses;
    return next;
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
  // `todoTxtSource()` is the loose user-facing entry (defaulted keys omitted);
  // widen it to the strict union member, whose defaults groundcrew fills at load.
  const sources = enabled ? [...others, todoTxtSource() as Source] : others;
  return { ...draft, sources };
}

export function getTodoTxtField(
  draft: ConfigDraft,
  field: TodoTxtField,
): string | undefined {
  const value = (draft.sources ?? []).find(isTodoTxtKind)?.[field];
  return typeof value === "string" ? value : undefined;
}

export function setTodoTxtField(
  draft: ConfigDraft,
  field: TodoTxtField,
  value: string,
): ConfigDraft {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isTodoTxtKind(s)) return s;
    const next: TodoTxtSource = { ...s };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next;
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
  const commands: unknown = (draft.sources ?? []).find(isPlanKeeper)?.commands;
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

/**
 * The shell lifecycle commands the builder edits, in display order. Of these,
 * `listTasks` (or its legacy `fetch` alias) is the one required command — a
 * source with neither can't enumerate tasks. The legacy `fetch`/`resolveOne`
 * aliases are read as a fallback (see `readShellFields`) but are never written
 * back: the builder always emits the preferred `listTasks`/`getTask` names.
 */
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

export function shellSources(draft: ConfigDraft): ShellSource[] {
  return (draft.sources ?? []).filter(isGenericShell);
}

/**
 * The command groundcrew runs to enumerate a shell source's tasks: the preferred
 * `commands.listTasks`, falling back to the legacy `commands.fetch` alias.
 * `undefined` when neither is set (the source can't list tasks).
 */
export function shellListTasksCommand(source: Source): string | undefined {
  if (!isShellKind(source)) return undefined;
  // `commands` is required by the type, but malformed on-disk JSON (hand-edited)
  // can omit it; guard before reading so render never crashes (cf. readShellFields).
  const commands = (source.commands as Record<string, unknown>) ?? {};
  const value = commands.listTasks ?? commands.fetch;
  return typeof value === "string" ? value : undefined;
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
    const name = (s as SourceCommon).name;
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
): ShellSource {
  // Carry forward unmanaged keys (e.g. `timeouts`) only when `base` is already a
  // shell source; a different-kind base is replaced wholesale.
  const carried: ShellSource =
    base !== undefined && isShellKind(base)
      ? { ...base }
      : { kind: "shell", name: fields.name.trim(), commands: {} };
  const commands: ShellSource["commands"] = { ...carried.commands };
  delete commands.fetch;
  delete commands.resolveOne;
  for (const key of SHELL_COMMAND_FIELDS) {
    if (fields[key].length === 0) delete commands[key];
    else commands[key] = fields[key];
  }
  const src: ShellSource = {
    ...carried,
    kind: "shell",
    name: fields.name.trim(),
    commands,
  };
  if (fields.cwd.trim().length === 0) delete src.cwd;
  else src.cwd = fields.cwd;
  const env: Record<string, string> = {};
  for (const entry of fields.env) {
    const key = entry.key.trim();
    if (key.length > 0) env[key] = entry.value;
  }
  if (Object.keys(env).length === 0) delete src.env;
  else src.env = env;
  return src;
}

/** Sources with no managed screen (not linear / todo-txt / plan-keeper). */
export function customSources(draft: ConfigDraft): Source[] {
  return (draft.sources ?? []).filter((s) => !isManaged(s));
}

export function customSourceCount(draft: ConfigDraft): number {
  return customSources(draft).length;
}

/**
 * Per-row modified flags for the Task Sources hub. Each row owns a slice of
 * `draft.sources` (its kind's entry, or the whole shell array); a row is
 * modified iff its slice differs from baseline's. Catches the enable toggle
 * (entry appearing/disappearing) and any inner-field change in one pass, so the
 * hub need not re-derive comparisons per sub-form.
 */
export function taskSourceModified(
  draft: ConfigDraft,
  baseline: ConfigDraft,
): Record<"linear" | "todoTxt" | "planKeeper" | "shell", boolean> {
  const draftSources = draft.sources ?? [];
  const baseSources = baseline.sources ?? [];
  return {
    linear: !valuesEqual(
      draftSources.find(isLinearKind),
      baseSources.find(isLinearKind),
    ),
    todoTxt: !valuesEqual(
      draftSources.find(isTodoTxtKind),
      baseSources.find(isTodoTxtKind),
    ),
    planKeeper: !valuesEqual(
      draftSources.find(isPlanKeeper),
      baseSources.find(isPlanKeeper),
    ),
    shell: !valuesEqual(shellSources(draft), shellSources(baseline)),
  };
}
