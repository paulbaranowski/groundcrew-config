import type { Config } from "@clipboard-health/groundcrew";

/** A repository entry's object form: name + optional clone-parent override. */
export type KnownRepo = Exclude<
  Config["workspace"]["knownRepositories"][number],
  string
>;

/** The loose, user-facing config the TUI edits. Identical to groundcrew's `Config`. */
export type ConfigDraft = Config;

/**
 * Identifier for each editor section. Defined here (the earliest module) so both
 * the validator (maps errors → section) and the section registry import it
 * without an ordering dependency.
 */
export type SectionId =
  | "workspace" | "repositories" | "agents" | "ticketSources"
  | "orchestrator" | "usage" | "hooks" | "git" | "terminal"
  | "sandbox" | "prompts" | "advanced";

/** Local isolation/sandbox backends. groundcrew validates these; we list them for the UI. */
export const RUNNERS = ["auto", "safehouse", "srt", "sdx", "none"] as const;
export type Runner = (typeof RUNNERS)[number];

/** Terminal session managers. */
export const WORKSPACE_KINDS = ["auto", "cmux", "tmux", "zellij"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

/** Built-in agent presets that enable with `{}`. */
export const BUILT_IN_AGENTS = ["claude", "codex"] as const;

/** Orchestrator defaults groundcrew applies; shown as ghost values in the UI. */
export const ORCHESTRATOR_DEFAULTS = {
  maximumInProgress: 4,
  pollIntervalMilliseconds: 120_000,
  sessionLimitPercentage: 85,
} as const;

export const GIT_DEFAULTS = {
  remote: "origin",
  defaultBranch: "main",
} as const;
