import {
  GIT_DEFAULTS,
  ORCHESTRATOR_DEFAULTS,
  RUNNERS,
  WORKSPACE_KINDS,
  type ConfigDraft,
  type SectionId,
} from "./types.ts";

export type { SectionId };

export const SECTION_ORDER: SectionId[] = [
  "workspace",
  "models",
  "linear",
  "ticketSources",
  "orchestrator",
  "hooks",
  "git",
  "sandbox",
  "prompts",
  "advanced",
];

export const SECTION_LABEL: Record<SectionId, string> = {
  workspace: "Workspace",
  models: "Models",
  linear: "Linear",
  ticketSources: "Ticket Sources",
  orchestrator: "Orchestrator",
  hooks: "Hooks",
  git: "Git",
  sandbox: "Sandbox",
  prompts: "Prompts",
  advanced: "Advanced",
};

/** A field in the generic SectionForm. `path` is a dotted path into the draft. */
export interface FieldSpec {
  path: string;
  label: string;
  kind: "text" | "select" | "number";
  help: string;
  options?: readonly string[];
  placeholder?: string; // ghosted default
}

/** Field-specs for the spec-driven (non-bespoke) sections. */
export function simpleSectionSpec(id: SectionId): FieldSpec[] {
  switch (id) {
    case "orchestrator":
      return [
        {
          path: "orchestrator.maximumInProgress",
          label: "maximumInProgress",
          kind: "number",
          help: "Max tickets in progress at once.",
          placeholder: String(ORCHESTRATOR_DEFAULTS.maximumInProgress),
        },
        {
          path: "orchestrator.pollIntervalMilliseconds",
          label: "pollIntervalMilliseconds",
          kind: "number",
          help: "How often to poll for tickets (ms).",
          placeholder: String(ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds),
        },
        {
          path: "orchestrator.sessionLimitPercentage",
          label: "sessionLimitPercentage",
          kind: "number",
          help: "Stop launching above this session-usage %.",
          placeholder: String(ORCHESTRATOR_DEFAULTS.sessionLimitPercentage),
        },
      ];
    case "hooks":
      return [
        {
          path: "defaults.hooks.prepareWorktree",
          label: "prepareWorktree",
          kind: "text",
          help: "Fallback only — a repo's own .groundcrew/config.json wins. Runs after worktree create, before launch.",
        },
      ];
    case "git":
      return [
        {
          path: "git.remote",
          label: "remote",
          kind: "text",
          help: "Git remote name.",
          placeholder: GIT_DEFAULTS.remote,
        },
        {
          path: "git.defaultBranch",
          label: "defaultBranch",
          kind: "text",
          help: "Branch worktrees fork from.",
          placeholder: GIT_DEFAULTS.defaultBranch,
        },
        {
          path: "git.branchPrefix",
          label: "branchPrefix",
          kind: "text",
          help: "Branch name prefix. Defaults to your OS username.",
        },
      ];
    case "sandbox":
      return [
        {
          path: "local.runner",
          label: "runner",
          kind: "select",
          options: RUNNERS,
          help: "Local isolation backend. auto = safehouse (macOS) / sdx (Linux). none = unsandboxed.",
        },
      ];
    case "prompts":
      return [
        {
          path: "prompts.initial",
          label: "initial",
          kind: "text",
          help: "Initial agent prompt. Supports {{ticket}}, {{title}}, {{description}}, {{worktree}}, {{workspaceContinuationInstruction}}.",
        },
      ];
    case "advanced":
      return [
        {
          path: "workspaceKind",
          label: "workspaceKind",
          kind: "select",
          options: WORKSPACE_KINDS,
          help: "Terminal session manager. auto = cmux if present, else tmux.",
        },
        {
          path: "logging.file",
          label: "logging.file",
          kind: "text",
          help: "Append-mode log file. Defaults to XDG state dir.",
        },
      ];
    default:
      return [];
  }
}

function repoCount(draft: ConfigDraft): number {
  return draft.workspace.knownRepositories?.length ?? 0;
}

export function sectionSummary(id: SectionId, draft: ConfigDraft): string {
  switch (id) {
    case "workspace": {
      const n = repoCount(draft);
      return `${draft.workspace.projectDir} · ${n} repo${n === 1 ? "" : "s"}`;
    }
    case "models": {
      const defs = Object.keys(draft.models?.definitions ?? {});
      return defs.length === 0
        ? "none enabled"
        : `default: ${draft.models?.default ?? "?"} · ${defs.join(", ")}`;
    }
    case "linear": {
      const off = (draft.sources ?? []).some(
        (s) => s.kind === "linear" && s.enabled === false,
      );
      return off ? "disabled" : "enabled";
    }
    case "ticketSources": {
      const shells = (draft.sources ?? []).filter((s) => s.kind === "shell");
      return shells.length === 0 ? "none" : `${shells.length} shell`;
    }
    case "orchestrator": {
      const o = draft.orchestrator ?? {};
      const max =
        o.maximumInProgress ?? ORCHESTRATOR_DEFAULTS.maximumInProgress;
      const poll =
        (o.pollIntervalMilliseconds ??
          ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds) / 1000;
      const limit =
        o.sessionLimitPercentage ??
        ORCHESTRATOR_DEFAULTS.sessionLimitPercentage;
      return `max ${max} · poll ${poll}s · limit ${limit}%`;
    }
    case "hooks":
      return draft.defaults?.hooks?.prepareWorktree
        ? `fallback: ${draft.defaults.hooks.prepareWorktree}`
        : "none (per-repo only)";
    case "git":
      return `${draft.git?.remote ?? GIT_DEFAULTS.remote} · ${draft.git?.defaultBranch ?? GIT_DEFAULTS.defaultBranch}`;
    case "sandbox":
      return `runner: ${draft.local?.runner ?? "auto"}`;
    case "prompts":
      return draft.prompts?.initial
        ? `custom (${draft.prompts.initial.length} chars)`
        : "default";
    case "advanced":
      return `workspaceKind: ${draft.workspaceKind ?? "auto"}`;
    default:
      return "";
  }
}
