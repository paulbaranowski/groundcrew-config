import type { ConfigDraft } from "./types.ts";

type Source = NonNullable<ConfigDraft["sources"]>[number];

const PLAN_KEEPER_NAME = "plans";

/** A source's runtime name, falling back to its kind (mirrors groundcrew). */
function sourceName(source: Source): string {
  const named = source as { name?: string };
  return named.name ?? source.kind;
}

function isLinearOptOut(source: Source): boolean {
  return (
    source.kind === "linear" &&
    (source as { enabled?: boolean }).enabled === false
  );
}

function isPlanKeeper(source: Source): boolean {
  return source.kind === "shell" && sourceName(source) === PLAN_KEEPER_NAME;
}

/** The managed plan-keeper ticket source (bare `plan-keeper` command for PATH portability). */
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

export function isLinearDisabled(draft: ConfigDraft): boolean {
  return (draft.sources ?? []).some(isLinearOptOut);
}

export function setLinearEnabled(
  draft: ConfigDraft,
  enabled: boolean,
): ConfigDraft {
  const others = (draft.sources ?? []).filter((s) => !isLinearOptOut(s));
  const sources = enabled
    ? others
    : [...others, { kind: "linear", enabled: false } as unknown as Source];
  return { ...draft, sources };
}

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

/** Sources that are neither the built-in Linear entry nor the managed plan-keeper entry. */
export function customSourceCount(draft: ConfigDraft): number {
  return (draft.sources ?? []).filter(
    (s) => s.kind !== "linear" && !isPlanKeeper(s),
  ).length;
}
