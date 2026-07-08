import { valuesEqual } from "./diff.ts";
import {
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  readShellEnv,
  shellSourceNames,
  taskSourceModified,
  type EnvEntry,
} from "./sources.ts";
import type { ConfigDraft } from "./types.ts";

/**
 * Generic helpers for groundcrew's enable-by-kind manifest sources (open
 * registry, groundcrew ≥ 4.46): a discovered source is enabled with a bare
 * `{ kind: "<name>" }` entry, exactly like the builtins. This module owns that
 * by-kind surgery plus the catalog→hub-row projection; nothing here is
 * jira-specific. The catalog itself is loaded by `io/sourceCatalog.ts`.
 */

type Source = NonNullable<ConfigDraft["sources"]>[number];

/** One `prerequisites[]` entry of a source manifest (a binary the user installs). */
export interface ManifestPrerequisite {
  bin: string;
  install?: string;
  setup?: string;
}

/** One `secrets[]` entry of a source manifest (a credential the user provides). */
export interface ManifestSecret {
  env: string;
  file?: string;
  mode?: string;
  url?: string;
}

/**
 * The slice of groundcrew's `SourceManifest` the TUI renders. Kept structural
 * (not imported) so the domain layer stays decoupled from the not-yet-released
 * groundcrew export; `io/sourceCatalog.ts` narrows the real manifest into this.
 */
export interface SourceManifestInfo {
  name: string;
  description?: string;
  installDir?: string;
  prerequisites: ManifestPrerequisite[];
  secrets: ManifestSecret[];
  env: Record<string, string>;
}

/**
 * One catalog row as consumed by the hub: groundcrew's `TaskSourceCatalogEntry`
 * joined (for discovered sources) with its manifest. Builtins carry no manifest.
 */
export interface CatalogSource {
  name: string;
  description: string;
  origin: "builtin" | "package" | "user";
  requiresCredentials: boolean;
  manifest?: SourceManifestInfo;
}

/** Where a hub row routes on enter: a bespoke screen, or the generic manifest form. */
export type HubRoute =
  | { screen: "linear" }
  | { screen: "todoTxt" }
  | { screen: "planKeeper" }
  | { screen: "shell" }
  | { screen: "manifest"; source: CatalogSource };

export interface HubRow {
  route: HubRoute;
  label: string;
  status: string;
  modified: boolean;
}

interface SourceCommon {
  kind: string;
  enabled?: boolean;
  env?: unknown;
}

function findKindEntry(draft: ConfigDraft, kind: string): Source | undefined {
  return (draft.sources ?? []).find((s) => s.kind === kind);
}

export function isKindEnabled(draft: ConfigDraft, kind: string): boolean {
  return (draft.sources ?? []).some(
    (s) => s.kind === kind && (s as SourceCommon).enabled !== false,
  );
}

/**
 * Toggle a by-kind source. Off: a bare `{ kind }` entry is removed (keeping the
 * saved config minimal), while an entry carrying anything else (env overrides,
 * name, …) is kept and marked `enabled: false` so the customization survives an
 * off/on round trip. On: an existing entry just loses its `enabled` flag; a
 * missing one is appended as bare `{ kind }`.
 */
export function setKindEnabled(
  draft: ConfigDraft,
  kind: string,
  enabled: boolean,
): ConfigDraft {
  const sources = draft.sources ?? [];
  const existing = findKindEntry(draft, kind);
  if (enabled) {
    if (existing === undefined) {
      // The union of known kinds can't type an open-registry entry; the bare
      // `{ kind }` shape is exactly what groundcrew's manifest adapter accepts.
      const entry = { kind } as unknown as Source;
      return { ...draft, sources: [...sources, entry] };
    }
    const revived = { ...(existing as SourceCommon) };
    delete revived.enabled;
    return {
      ...draft,
      sources: sources.map((s) => (s === existing ? (revived as Source) : s)),
    };
  }
  if (existing === undefined) return draft;
  const bare = Object.keys(existing).every((k) => k === "kind" || k === "enabled");
  if (bare) {
    return { ...draft, sources: sources.filter((s) => s !== existing) };
  }
  const disabled = { ...(existing as SourceCommon), enabled: false };
  return {
    ...draft,
    sources: sources.map((s) => (s === existing ? (disabled as Source) : s)),
  };
}

/** The kind entry's `env` overrides as ordered editor entries (empty when unset). */
export function readKindEnv(draft: ConfigDraft, kind: string): EnvEntry[] {
  return readShellEnv(findKindEntry(draft, kind));
}

/**
 * Rebuild the kind entry's `env` from editor entries: blank keys dropped, a
 * later duplicate key wins, an empty result removes the `env` key entirely.
 * No-op when the kind has no entry (the editor is only reachable while enabled).
 */
export function writeKindEnv(
  draft: ConfigDraft,
  kind: string,
  entries: readonly EnvEntry[],
): ConfigDraft {
  const existing = findKindEntry(draft, kind);
  if (existing === undefined) return draft;
  const env: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key.length > 0) env[key] = entry.value;
  }
  const next = { ...(existing as SourceCommon) };
  if (Object.keys(env).length === 0) delete next.env;
  else next.env = env;
  return {
    ...draft,
    sources: (draft.sources ?? []).map((s) =>
      s === existing ? (next as Source) : s,
    ),
  };
}

/** Catalog names that already have bespoke screens — never rendered as manifest rows. */
const BESPOKE_KINDS = new Set(["linear", "todo-txt", "shell"]);

/**
 * Project the source catalog and draft into the hub's ordered row models:
 * the builtin rows in their fixed order, discovered manifest sources
 * alphabetically after them, then the PlanKeeper preset and the shell builder.
 * With an empty catalog this is exactly the pre-catalog static hub.
 */
export function hubRows(
  catalog: readonly CatalogSource[],
  draft: ConfigDraft,
  baseline: ConfigDraft,
): HubRow[] {
  const modified = taskSourceModified(draft, baseline);
  const discovered = catalog
    .filter((c) => c.origin !== "builtin" && !BESPOKE_KINDS.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((source): HubRow => {
      const kind = source.name;
      return {
        route: { screen: "manifest", source },
        label: kind,
        status: isKindEnabled(draft, kind) ? "enabled" : "disabled",
        modified: !valuesEqual(
          findKindEntry(draft, kind),
          findKindEntry(baseline, kind),
        ),
      };
    });
  return [
    {
      route: { screen: "linear" },
      label: "Linear",
      status: isLinearEnabled(draft) ? "enabled" : "disabled",
      modified: modified.linear,
    },
    {
      route: { screen: "todoTxt" },
      label: "todo-txt",
      status: isTodoTxtEnabled(draft) ? "enabled" : "disabled",
      modified: modified.todoTxt,
    },
    ...discovered,
    {
      route: { screen: "planKeeper" },
      label: "PlanKeeper",
      status: isPlanKeeperEnabled(draft) ? "enabled" : "disabled",
      modified: modified.planKeeper,
    },
    {
      route: { screen: "shell" },
      label: "Shell sources",
      // Names (joined) instead of a bare count so the row can be scanned without
      // descending into the sub-form. `[].join(", ")` is "", so `|| "none"`
      // covers the empty case (mirrors the Home summary in sections.ts).
      status: shellSourceNames(draft).join(", ") || "none",
      modified: modified.shell,
    },
  ];
}
