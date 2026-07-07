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
  | "setup" | "workspace" | "repositories" | "agents" | "taskSources"
  | "orchestrator" | "usage" | "hooks" | "git" | "terminal"
  | "sandbox" | "prompts" | "advanced";

/** Local isolation/sandbox backends. groundcrew validates these; we list them for the UI. */
export const RUNNERS = ["auto", "safehouse", "srt", "sdx", "none"] as const;
export type Runner = (typeof RUNNERS)[number];

/**
 * Network egress posture for local launches. groundcrew defaults to
 * `"allowlisted"` (Clearance-wrapped); only the safehouse runner consumes it.
 * Listed here for the UI, mirroring groundcrew's `NetworkEgressSetting`.
 */
export const NETWORK_EGRESS = ["allowlisted", "open"] as const;
export type NetworkEgress = (typeof NETWORK_EGRESS)[number];

/** Terminal session managers. */
export const WORKSPACE_KINDS = ["auto", "cmux", "tmux", "zellij"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

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
