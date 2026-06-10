import {
  GIT_DEFAULTS,
  ORCHESTRATOR_DEFAULTS,
  RUNNERS,
  WORKSPACE_KINDS,
  type ConfigDraft,
  type SectionId,
} from "./types.ts";
import {
  customSourceCount,
  enabledSourceCount,
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  shellSourceCount,
} from "./sources.ts";
import { isUsageDisabled } from "./usage.ts";

export type { SectionId };

export const SECTION_ORDER: SectionId[] = [
  "workspace",
  "repositories",
  "agents",
  "ticketSources",
  "orchestrator",
  "usage",
  "hooks",
  "git",
  "terminal",
  "sandbox",
  "prompts",
  "advanced",
];

export const SECTION_LABEL: Record<SectionId, string> = {
  workspace: "Workspace",
  repositories: "Repositories",
  agents: "Agents",
  ticketSources: "Task Sources",
  orchestrator: "Orchestrator",
  usage: "Usage",
  hooks: "Hooks",
  git: "Git",
  terminal: "Terminal",
  sandbox: "Sandbox",
  prompts: "Prompts",
  advanced: "Logging",
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
          help: "Initial agent prompt. Supports {{task}}, {{title}}, {{description}}, {{worktree}}, {{workspaceContinuationInstruction}}.",
        },
      ];
    case "terminal":
      return [
        {
          path: "workspaceKind",
          label: "workspaceKind",
          kind: "select",
          options: WORKSPACE_KINDS,
          help: "Terminal session manager. auto = cmux if present, else tmux.",
        },
      ];
    case "advanced":
      return [
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
    case "workspace":
      return draft.workspace.projectDir;
    case "repositories": {
      const n = repoCount(draft);
      return `${n} repo${n === 1 ? "" : "s"}`;
    }
    case "agents": {
      const defs = Object.keys(draft.agents?.definitions ?? {});
      return defs.length === 0
        ? "none enabled"
        : `default: ${draft.agents?.default ?? "?"} · ${defs.join(", ")}`;
    }
    case "ticketSources": {
      if (enabledSourceCount(draft) === 0) return "none — crew won't run";
      const kinds: string[] = [];
      if (isLinearEnabled(draft)) kinds.push("linear");
      if (isTodoTxtEnabled(draft)) kinds.push("todo-txt");
      if (isPlanKeeperEnabled(draft)) kinds.push("plan-keeper");
      const shell = shellSourceCount(draft);
      if (shell > 0) kinds.push(`${shell} shell`);
      const custom = customSourceCount(draft);
      if (custom > 0) kinds.push(`${custom} custom`);
      return kinds.join(", ");
    }
    case "usage":
      return isUsageDisabled(draft.agents)
        ? "tracking disabled"
        : "tracking enabled";
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
    case "terminal":
      return `workspaceKind: ${draft.workspaceKind ?? "auto"}`;
    case "advanced":
      return draft.logging?.file ? `log: ${draft.logging.file}` : "defaults";
    default:
      return "";
  }
}
