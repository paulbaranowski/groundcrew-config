import {
  GIT_DEFAULTS,
  NETWORK_EGRESS,
  ORCHESTRATOR_DEFAULTS,
  RUNNERS,
  WORKSPACE_KINDS,
  type ConfigDraft,
  type SectionId,
} from "./types.ts";
import {
  customKindNames,
  enabledSourceCount,
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  shellSourceNames,
} from "./sources.ts";
import { isUsageDisabled } from "./usage.ts";

export type { SectionId };

export const SECTION_ORDER: SectionId[] = [
  // The six primary setup sections, in the order a new user works through them.
  "repositories",
  "workspace",
  "taskSources",
  "agents",
  "terminal",
  "sandbox",
  // Advanced/optional sections follow, reachable below the essentials.
  "orchestrator",
  "usage",
  "hooks",
  "git",
  "prompts",
  "advanced",
];

export const SECTION_LABEL: Record<SectionId, string> = {
  workspace: "Workspace",
  repositories: "Repositories",
  agents: "Agents",
  taskSources: "Task Sources",
  orchestrator: "Orchestrator",
  usage: "Usage Limits",
  hooks: "Hooks",
  git: "Git",
  terminal: "Terminal",
  sandbox: "Sandbox",
  prompts: "Prompts",
  advanced: "Logging",
};

/**
 * Plain-English, one-line purpose for each section, written for someone who has
 * never used groundcrew. Shown at the top of each screen's help block. The
 * spec-driven sections (SectionForm) read theirs from here directly; the bespoke
 * screens carry their own (longer) copy inline.
 */
export const SECTION_DESCRIPTION: Record<SectionId, string> = {
  workspace:
    "Where groundcrew keeps your code. projectDir is the folder that holds your repos; each task runs in a throwaway copy (a \"git worktree\") created under worktreeDir. Add the repos themselves in the Repositories section.",
  repositories:
    "The repos groundcrew is allowed to work on, listed by their local folder name (each must already exist under your projectDir).",
  agents:
    "The AI coding tools groundcrew runs on your tasks (e.g. Claude, Codex). Check the ones installed on your machine. \"bypass permission prompts\" lets the agent act without stopping to ask.",
  taskSources:
    "Where groundcrew gets its to-do list. Turn on one or more sources of tasks for it to work through.",
  orchestrator:
    "Controls how many tasks groundcrew runs at once and how often it checks for new ones.",
  usage:
    "Usage tracking lets groundcrew watch your AI subscription's usage so it won't launch agents when you're near your limits. Disabling opts every enabled agent out. The session limit % is the usage ceiling above which it stops launching new agents.",
  hooks:
    "A shell command run right after each worktree is created (e.g. install dependencies). A repo's own config overrides this.",
  git: "Git settings groundcrew uses when creating branches and worktrees.",
  terminal:
    "Which terminal multiplexer hosts the running agents (tmux, cmux, or zellij).",
  sandbox:
    "Pick the sandbox that isolates each agent from the rest of your machine while it runs. networkEgress controls the agent's network access (safehouse runner only).",
  prompts:
    "The instructions groundcrew gives the agent at the start of every task.",
  advanced: "Where groundcrew writes its log file.",
};

/**
 * The dotted paths the spec-driven sections write into the draft. Every `path`
 * value produced by `simpleSectionSpec` appears here; adding a field to a
 * spec-driven section means adding its path to this union (typecheck enforces
 * the round trip through `setByPath`).
 */
export type FieldPath =
  | "orchestrator.maximumInProgress"
  | "orchestrator.pollIntervalMilliseconds"
  | "defaults.hooks.prepareWorktree"
  | "git.remote"
  | "git.defaultBranch"
  | "git.branchPrefix"
  | "local.runner"
  | "local.networkEgress"
  | "prompts.initial"
  | "prompts.promptFile"
  | "workspaceKind"
  | "logging.file";

/**
 * A field in the generic SectionForm. `path` is a dotted path into the draft;
 * for a `kind: "select"` field, the `options` values must be assignable to the
 * draft field that `path` points at (they are stored verbatim via `setByPath`).
 */
export interface FieldSpec {
  path: FieldPath;
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
          help: "Max tasks in progress at once.",
          placeholder: String(ORCHESTRATOR_DEFAULTS.maximumInProgress),
        },
        {
          path: "orchestrator.pollIntervalMilliseconds",
          label: "pollIntervalMilliseconds",
          kind: "number",
          help: "How often to poll for tasks (ms).",
          placeholder: String(ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds),
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
          help: [
            "• auto — chooses for you (safehouse on macOS, sdx on Linux)",
            "• safehouse — macOS only",
            "• srt — Anthropic sandbox-runtime, fast & no Docker, macOS + Linux/WSL",
            "• sdx — Docker Sandboxes, needs Docker, macOS + Linux",
            "• none — no sandbox (unsafe)",
          ].join("\n"),
        },
        {
          path: "local.networkEgress",
          label: "networkEgress",
          kind: "select",
          options: NETWORK_EGRESS,
          help: [
            "Network access for agents. Only the safehouse runner uses this; srt/sdx/none ignore it.",
            "• allowlisted — Clearance-wrapped: deny network except the egress allowlist (default)",
            "• open — keep the filesystem sandbox but open network egress (no Clearance)",
          ].join("\n"),
        },
      ];
    case "prompts":
      return [
        {
          path: "prompts.initial",
          label: "initial",
          kind: "text",
          help: "Inline initial agent prompt. Mutually exclusive with promptFile. Supports {{task}}, {{title}}, {{description}}, {{worktree}}, {{workspaceContinuationInstruction}}.",
        },
        {
          path: "prompts.promptFile",
          label: "promptFile",
          kind: "text",
          help: "Path to a file whose contents become the initial prompt. Resolved relative to the config dir; ~ expands. Mutually exclusive with initial.",
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
    case "workspace": {
      const { projectDir, worktreeDir } = draft.workspace;
      return `${projectDir} · worktreeDir: ${worktreeDir ?? projectDir}`;
    }
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
    case "taskSources": {
      if (enabledSourceCount(draft) === 0) return "none — crew won't run";
      const kinds: string[] = [];
      if (isLinearEnabled(draft)) kinds.push("linear");
      if (isTodoTxtEnabled(draft)) kinds.push("todo-txt");
      if (isPlanKeeperEnabled(draft)) kinds.push("plan-keeper");
      kinds.push(...shellSourceNames(draft));
      // Enable-by-kind manifest sources (jira, …) and any other unmanaged kinds.
      kinds.push(...customKindNames(draft));
      return kinds.join(", ");
    }
    case "usage": {
      if (isUsageDisabled(draft.agents)) return "tracking disabled";
      const limit =
        draft.orchestrator?.sessionLimitPercentage ??
        ORCHESTRATOR_DEFAULTS.sessionLimitPercentage;
      return `tracking enabled · limit ${limit}%`;
    }
    case "orchestrator": {
      const o = draft.orchestrator ?? {};
      const max =
        o.maximumInProgress ?? ORCHESTRATOR_DEFAULTS.maximumInProgress;
      const poll =
        (o.pollIntervalMilliseconds ??
          ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds) / 1000;
      return `max ${max} · poll ${poll}s`;
    }
    case "hooks":
      return draft.defaults?.hooks?.prepareWorktree
        ? `fallback: ${draft.defaults.hooks.prepareWorktree}`
        : "none (per-repo only)";
    case "git":
      return `${draft.git?.remote ?? GIT_DEFAULTS.remote} · ${draft.git?.defaultBranch ?? GIT_DEFAULTS.defaultBranch}`;
    case "sandbox":
      return `runner: ${draft.local?.runner ?? "auto"} · egress: ${
        draft.local?.networkEgress ?? "allowlisted"
      }`;
    case "prompts": {
      const prompts = draft.prompts ?? {};
      if (prompts.promptFile) return `file: ${prompts.promptFile}`;
      return prompts.initial
        ? `custom (${prompts.initial.length} chars)`
        : "default";
    }
    case "terminal":
      return `workspaceKind: ${draft.workspaceKind ?? "auto"}`;
    case "advanced":
      return draft.logging?.file ? `log: ${draft.logging.file}` : "defaults";
    default:
      return "";
  }
}
