import type { ConfigDraft } from "./types.ts";

type Source = NonNullable<ConfigDraft["sources"]>[number];
type TodoTxtField = "todoPath" | "tasksDir";

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

function isPlanKeeper(source: Source): boolean {
  return source.kind === "shell" && sourceName(source) === PLAN_KEEPER_NAME;
}

/** True for any source the TUI manages with its own screen (Linear, todo-txt, PlanKeeper). */
function isManaged(source: Source): boolean {
  return isLinearKind(source) || isTodoTxtKind(source) || isPlanKeeper(source);
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
  if (commands === undefined || typeof commands !== "object") return undefined;
  return Object.entries(commands as Record<string, unknown>).filter(
    (pair): pair is [string, string] => typeof pair[1] === "string",
  );
}

/** Sources crew would actually run (anything not opted out with enabled:false). */
export function enabledSourceCount(draft: ConfigDraft): number {
  return (draft.sources ?? []).filter((s) => !isDisabled(s)).length;
}

/** Sources with no managed screen (not linear / todo-txt / plan-keeper). */
export function customSources(draft: ConfigDraft): Source[] {
  return (draft.sources ?? []).filter((s) => !isManaged(s));
}

export function customSourceCount(draft: ConfigDraft): number {
  return customSources(draft).length;
}

/**
 * Replace the custom (unmanaged) sources, preserving every managed entry. Lets
 * the raw-JSON editor show only custom sources without dropping linear /
 * todo-txt / plan-keeper, which keep their own screens.
 */
export function setCustomSources(
  draft: ConfigDraft,
  custom: readonly Source[],
): ConfigDraft {
  const managed = (draft.sources ?? []).filter(isManaged);
  return { ...draft, sources: [...managed, ...custom] };
}
