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

/**
 * The dotted paths the spec-driven sections (SectionForm/`simpleSectionSpec`)
 * write into the draft. `sections.ts` re-exports this as `FieldPath` for
 * `FieldSpec.path`; every `path` a spec produces must appear here.
 */
export type SpecFieldPath =
  | "orchestrator.maximumInProgress"
  | "orchestrator.pollIntervalMilliseconds"
  | "defaults.hooks.prepareWorktree"
  | "git.remote"
  | "git.defaultBranch"
  | "git.branchPrefix"
  | "prompts.initial"
  | "prompts.promptFile"
  | "workspaceKind"
  | "logging.file";

/** The `local.*` paths the bespoke Sandbox editor (SandboxForm) writes. */
export type SandboxPath =
  | "local.runner"
  | "local.networkEgress"
  | "local.readOnlyDirs"
  | "local.safehouse.enable";

/** The paths the bespoke Workspace editor (WorkspaceForm) writes. */
export type WorkspacePath = "workspace.projectDir" | "workspace.worktreeDir";

/**
 * Every statically-known writable leaf path in the draft — the single registry
 * of what the editors write, and the typed `path` argument to `getByPath`. A
 * screen that writes a leaf types its writer against the matching subset union
 * (see SandboxForm/WorkspaceForm), so a typo'd path fails to compile instead of
 * silently writing a dead key into the saved config.
 */
export type DraftPath = SpecFieldPath | SandboxPath | WorkspacePath;

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
