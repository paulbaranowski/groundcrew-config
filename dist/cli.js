#!/usr/bin/env node

// src/cli.tsx
import { render } from "ink";

// src/app.tsx
import { useEffect as useEffect3, useMemo as useMemo2, useState as useState22 } from "react";
import { Box as Box28, Text as Text28, useApp, useInput as useInput26 } from "ink";

// src/components/Footer.tsx
import { Box, Text } from "ink";
import { jsx, jsxs } from "react/jsx-runtime";
function Footer({
  dirty,
  issues,
  hint,
  valid = true,
  checked = true,
  noSources = false
}) {
  return /* @__PURE__ */ jsxs(
    Box,
    {
      justifyContent: "space-between",
      borderStyle: "single",
      borderBottom: false,
      borderLeft: false,
      borderRight: false,
      children: [
        /* @__PURE__ */ jsxs(Text, { children: [
          issues > 0 ? /* @__PURE__ */ jsxs(Text, { color: "yellow", children: [
            "\u26A0 ",
            issues,
            " issue",
            issues === 1 ? "" : "s"
          ] }) : !checked ? /* @__PURE__ */ jsx(Text, { dimColor: true, children: "\u2026 checking" }) : valid ? /* @__PURE__ */ jsx(Text, { color: "green", children: "\u2713 valid" }) : /* @__PURE__ */ jsx(Text, { color: "yellow", children: "\u26A0 invalid" }),
          noSources ? /* @__PURE__ */ jsx(Text, { color: "yellow", children: " \xB7 \u26A0 no task sources" }) : null,
          dirty ? /* @__PURE__ */ jsx(Text, { color: "yellow", children: " \xB7 \u25CF unsaved" }) : null
        ] }),
        /* @__PURE__ */ jsx(Text, { dimColor: true, children: hint })
      ]
    }
  );
}

// src/hooks/useFullscreen.ts
import { useEffect, useState } from "react";
import { useStdout } from "ink";
var ENTER_ALT_SCREEN = "\x1B[?1049h";
var LEAVE_ALT_SCREEN = "\x1B[?1049l";
var HIDE_CURSOR = "\x1B[?25l";
var SHOW_CURSOR = "\x1B[?25h";
var CLEAR_SCREEN = "\x1B[2J\x1B[H";
var MIN_ROWS = 10;
var MIN_COLUMNS = 40;
var SIGNAL_EXIT_CODE = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143
};
var FATAL_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
function createFullscreen(stdout) {
  let entered = false;
  let restored = false;
  return {
    enter() {
      if (!stdout.isTTY || entered) return;
      entered = true;
      stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR + CLEAR_SCREEN);
    },
    exit() {
      if (!entered || restored) return;
      restored = true;
      stdout.write(SHOW_CURSOR + LEAVE_ALT_SCREEN);
    }
  };
}
function installFullscreen(controller, proc = process) {
  const restore = () => controller.exit();
  const onSignal = (signal) => {
    restore();
    proc.exit(SIGNAL_EXIT_CODE[signal] ?? 1);
  };
  const signalListeners = FATAL_SIGNALS.map(
    (signal) => [signal, () => onSignal(signal)]
  );
  const onFatalError = (error) => {
    restore();
    console.error(error);
    proc.exit(1);
  };
  proc.on("exit", restore);
  for (const [signal, listener] of signalListeners) proc.on(signal, listener);
  proc.on("uncaughtException", onFatalError);
  proc.on("unhandledRejection", onFatalError);
  controller.enter();
  return () => {
    restore();
    proc.off("exit", restore);
    for (const [signal, listener] of signalListeners) proc.off(signal, listener);
    proc.off("uncaughtException", onFatalError);
    proc.off("unhandledRejection", onFatalError);
  };
}
function readSize(stdout) {
  return {
    rows: Math.max(stdout?.rows ?? 24, MIN_ROWS),
    columns: Math.max(stdout?.columns ?? 80, MIN_COLUMNS)
  };
}
function useFullscreen() {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => readSize(stdout));
  useEffect(() => {
    if (!stdout?.isTTY) return;
    const onResize = () => setSize(readSize(stdout));
    onResize();
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return size;
}

// src/domain/types.ts
var RUNNERS = ["auto", "safehouse", "srt", "sdx", "none"];
var NETWORK_EGRESS = ["allowlisted", "open"];
var WORKSPACE_KINDS = ["auto", "cmux", "tmux", "zellij"];
var ORCHESTRATOR_DEFAULTS = {
  maximumInProgress: 4,
  pollIntervalMilliseconds: 12e4,
  sessionLimitPercentage: 85
};
var GIT_DEFAULTS = {
  remote: "origin",
  defaultBranch: "main"
};

// src/domain/guards.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/domain/diff.ts
function valuesEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isObject(a) && isObject(b)) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!valuesEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}
function changedPaths(a, b) {
  const paths = [];
  walk(a, b, "", paths);
  return paths;
}
function walk(a, b, prefix, out) {
  if (valuesEqual(a, b)) return;
  const aArray = Array.isArray(a);
  const bArray = Array.isArray(b);
  const aObject = isObject(a);
  const bObject = isObject(b);
  if ((aArray || bArray) && (aArray || a === void 0) && (bArray || b === void 0)) {
    const aa = aArray ? a : [];
    const bb = bArray ? b : [];
    if (aa.length !== bb.length) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < aa.length; i++) {
      walk(aa[i], bb[i], join(prefix, String(i)), out);
    }
    return;
  }
  if ((aObject || bObject) && (aObject || a === void 0) && (bObject || b === void 0)) {
    const aa = aObject ? a : {};
    const bb = bObject ? b : {};
    const keys = /* @__PURE__ */ new Set([...Object.keys(aa), ...Object.keys(bb)]);
    for (const key of keys) {
      walk(aa[key], bb[key], join(prefix, key), out);
    }
    return;
  }
  out.push(prefix);
}
function join(prefix, segment) {
  return prefix.length === 0 ? segment : `${prefix}.${segment}`;
}

// src/domain/sources.ts
var PLAN_KEEPER_NAME = "plankeeper";
function sourceName(source) {
  return source.name ?? source.kind;
}
function isDisabled(source) {
  return source.enabled === false;
}
function isLinearKind(source) {
  return source.kind === "linear";
}
function isTodoTxtKind(source) {
  return source.kind === "todo-txt";
}
function isShellKind(source) {
  return source.kind === "shell";
}
function isPlanKeeper(source) {
  return isShellKind(source) && sourceName(source) === PLAN_KEEPER_NAME;
}
function isGenericShell(source) {
  return isShellKind(source) && !isPlanKeeper(source);
}
var PLAN_KEEPER_SANDBOX_PATH = "~/plans";
function migratePlanKeeperSandboxPaths(draft) {
  const sources = draft.sources;
  if (sources === void 0) return draft;
  let changed = false;
  const next = sources.map((source) => {
    if (!isPlanKeeper(source)) return source;
    const existing = readShellSandboxPaths(source);
    if (existing.includes(PLAN_KEEPER_SANDBOX_PATH)) return source;
    changed = true;
    return {
      ...source,
      sandboxWritePaths: [PLAN_KEEPER_SANDBOX_PATH, ...existing]
    };
  });
  return changed ? { ...draft, sources: next } : draft;
}
function planKeeperSource() {
  return {
    kind: "shell",
    name: PLAN_KEEPER_NAME,
    commands: {
      verify: "plan-keeper crew fetch >/dev/null",
      fetch: "plan-keeper crew fetch",
      resolveOne: "plan-keeper crew get ${id}",
      markInProgress: "plan-keeper crew start ${id}",
      markInReview: "plan-keeper crew review ${id}"
    },
    // plan-keeper writes task state under ~/plans; pre-grant the sandbox so the
    // preset works out of the box on groundcrew ≥ 4.42 without a manual edit.
    sandboxWritePaths: [PLAN_KEEPER_SANDBOX_PATH]
  };
}
function todoTxtSource() {
  return { kind: "todo-txt" };
}
function isLinearEnabled(draft) {
  return (draft.sources ?? []).some((s) => isLinearKind(s) && !isDisabled(s));
}
function setLinearEnabled(draft, enabled) {
  const others = (draft.sources ?? []).filter((s) => !isLinearKind(s));
  const sources = enabled ? [...others, { kind: "linear" }] : others;
  return { ...draft, sources };
}
function findLinear(draft) {
  return (draft.sources ?? []).find(isLinearKind);
}
function getLinearField(draft, field) {
  const value = findLinear(draft)?.[field];
  return typeof value === "string" ? value : void 0;
}
function setLinearField(draft, field, value) {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isLinearKind(s)) return s;
    const next = { ...s };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next;
  });
  return { ...draft, sources };
}
function getLinearStatuses(draft, field) {
  const names = findLinear(draft)?.statuses?.[field];
  return Array.isArray(names) ? names.filter((n) => typeof n === "string").join(", ") : "";
}
function setLinearStatuses(draft, field, value) {
  const names = value.split(",").map((n) => n.trim()).filter((n) => n.length > 0);
  const sources = (draft.sources ?? []).map((s) => {
    if (!isLinearKind(s)) return s;
    const next = { ...s };
    const statuses = { ...next.statuses ?? {} };
    if (names.length === 0) delete statuses[field];
    else statuses[field] = names;
    if (Object.keys(statuses).length === 0) delete next.statuses;
    else next.statuses = statuses;
    return next;
  });
  return { ...draft, sources };
}
function isTodoTxtEnabled(draft) {
  return (draft.sources ?? []).some((s) => isTodoTxtKind(s) && !isDisabled(s));
}
function setTodoTxtEnabled(draft, enabled) {
  const others = (draft.sources ?? []).filter((s) => !isTodoTxtKind(s));
  const sources = enabled ? [...others, todoTxtSource()] : others;
  return { ...draft, sources };
}
function getTodoTxtField(draft, field) {
  const value = (draft.sources ?? []).find(isTodoTxtKind)?.[field];
  return typeof value === "string" ? value : void 0;
}
function setTodoTxtField(draft, field, value) {
  const sources = (draft.sources ?? []).map((s) => {
    if (!isTodoTxtKind(s)) return s;
    const next = { ...s };
    if (value.length === 0) delete next[field];
    else next[field] = value;
    return next;
  });
  return { ...draft, sources };
}
function isPlanKeeperEnabled(draft) {
  return (draft.sources ?? []).some(isPlanKeeper);
}
function setPlanKeeperEnabled(draft, enabled) {
  const others = (draft.sources ?? []).filter((s) => !isPlanKeeper(s));
  const sources = enabled ? [...others, planKeeperSource()] : others;
  return { ...draft, sources };
}
function planKeeperCommands(draft) {
  const commands = (draft.sources ?? []).find(isPlanKeeper)?.commands;
  if (commands === null || typeof commands !== "object") return void 0;
  return Object.entries(commands).filter(
    (pair) => typeof pair[1] === "string"
  );
}
function planKeeperSandboxPaths(draft) {
  const entry = (draft.sources ?? []).find(isPlanKeeper);
  if (entry === void 0) return void 0;
  return readShellSandboxPaths(entry);
}
function enabledSourceCount(draft) {
  return (draft.sources ?? []).filter((s) => !isDisabled(s)).length;
}
var SHELL_COMMAND_FIELDS = [
  "verify",
  "validate",
  "listTasks",
  "getTask",
  "createTask",
  "markInProgress",
  "markInReview",
  "markDone"
];
function shellSources(draft) {
  return (draft.sources ?? []).filter(isGenericShell);
}
function shellListTasksCommand(source) {
  if (!isShellKind(source)) return void 0;
  const commands = source.commands ?? {};
  const value = commands.listTasks ?? commands.fetch;
  return typeof value === "string" ? value : void 0;
}
function shellSourceNames(draft) {
  return shellSources(draft).map((s) => {
    const name = s.name;
    return name !== void 0 && name.trim().length > 0 ? name : "shell";
  });
}
function setShellSources(draft, entries) {
  const others = (draft.sources ?? []).filter((s) => !isGenericShell(s));
  return { ...draft, sources: [...others, ...entries.filter(isGenericShell)] };
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
function readShellEnv(source) {
  const raw = source?.env;
  if (raw === null || typeof raw !== "object") return [];
  return Object.entries(raw).filter((pair) => typeof pair[1] === "string").map(([key, value]) => ({ key, value }));
}
function readShellSandboxPaths(source) {
  const raw = source?.sandboxWritePaths;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry) => typeof entry === "string");
}
function readShellFields(source) {
  const s = source ?? {};
  const c = s.commands ?? {};
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
    sandboxWritePaths: readShellSandboxPaths(source)
  };
}
function applyShellFields(base, fields) {
  const carried = base !== void 0 && isShellKind(base) ? { ...base } : { kind: "shell", name: fields.name.trim(), commands: {} };
  const commands = { ...carried.commands };
  delete commands.fetch;
  delete commands.resolveOne;
  for (const key of SHELL_COMMAND_FIELDS) {
    if (fields[key].length === 0) delete commands[key];
    else commands[key] = fields[key];
  }
  const src = {
    ...carried,
    kind: "shell",
    name: fields.name.trim(),
    commands
  };
  if (fields.cwd.trim().length === 0) delete src.cwd;
  else src.cwd = fields.cwd;
  const env = {};
  for (const entry of fields.env) {
    const key = entry.key.trim();
    if (key.length > 0) env[key] = entry.value;
  }
  if (Object.keys(env).length === 0) delete src.env;
  else src.env = env;
  const paths = fields.sandboxWritePaths.map((p) => p.trim()).filter((p) => p.length > 0);
  if (paths.length === 0) delete src.sandboxWritePaths;
  else src.sandboxWritePaths = paths;
  return src;
}
function taskSourceModified(draft, baseline) {
  const draftSources = draft.sources ?? [];
  const baseSources = baseline.sources ?? [];
  return {
    linear: !valuesEqual(
      draftSources.find(isLinearKind),
      baseSources.find(isLinearKind)
    ),
    todoTxt: !valuesEqual(
      draftSources.find(isTodoTxtKind),
      baseSources.find(isTodoTxtKind)
    ),
    planKeeper: !valuesEqual(
      draftSources.find(isPlanKeeper),
      baseSources.find(isPlanKeeper)
    ),
    shell: !valuesEqual(shellSources(draft), shellSources(baseline))
  };
}

// src/domain/usage.ts
function isDisabledSentinel(value) {
  return typeof value === "object" && value !== null && value.disabled === true;
}
function isUsageDisabled(agents) {
  const definitions = agents?.definitions ?? {};
  const entries = Object.values(definitions);
  if (entries.length === 0) return false;
  return entries.every(
    (def) => isDisabledSentinel(def.usage)
  );
}
function setUsageDisabled(agents, disabled) {
  const definitions = agents?.definitions ?? {};
  const next = {};
  for (const [name, def] of Object.entries(definitions)) {
    const entry = { ...def };
    if (disabled) {
      entry.usage = { disabled: true };
    } else if (isDisabledSentinel(entry.usage)) {
      delete entry.usage;
    }
    next[name] = entry;
  }
  return { ...agents, definitions: next };
}

// src/domain/sections.ts
var SECTION_ORDER = [
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
  "advanced"
];
var SECTION_LABEL = {
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
  advanced: "Logging"
};
var SECTION_DESCRIPTION = {
  workspace: 'Where groundcrew keeps your code. projectDir is the folder that holds your repos; each task runs in a throwaway copy (a "git worktree") created under worktreeDir. Add the repos themselves in the Repositories section.',
  repositories: "The repos groundcrew is allowed to work on, listed by their local folder name (each must already exist under your projectDir).",
  agents: 'The AI coding tools groundcrew runs on your tasks (e.g. Claude, Codex). Check the ones installed on your machine. "bypass permission prompts" lets the agent act without stopping to ask.',
  taskSources: "Where groundcrew gets its to-do list. Turn on one or more sources of tasks for it to work through.",
  orchestrator: "Controls how many tasks groundcrew runs at once and how often it checks for new ones.",
  usage: "Usage tracking lets groundcrew watch your AI subscription's usage so it won't launch agents when you're near your limits. Disabling opts every enabled agent out. The session limit % is the usage ceiling above which it stops launching new agents.",
  hooks: "A shell command run right after each worktree is created (e.g. install dependencies). A repo's own config overrides this.",
  git: "Git settings groundcrew uses when creating branches and worktrees.",
  terminal: "Which terminal multiplexer hosts the running agents (tmux, cmux, or zellij).",
  sandbox: "Pick the sandbox that isolates each agent from the rest of your machine while it runs. networkEgress controls the agent's network access (safehouse runner only).",
  prompts: "The instructions groundcrew gives the agent at the start of every task.",
  advanced: "Where groundcrew writes its log file."
};
function simpleSectionSpec(id) {
  switch (id) {
    case "orchestrator":
      return [
        {
          path: "orchestrator.maximumInProgress",
          label: "maximumInProgress",
          kind: "number",
          help: "Max tasks in progress at once.",
          placeholder: String(ORCHESTRATOR_DEFAULTS.maximumInProgress)
        },
        {
          path: "orchestrator.pollIntervalMilliseconds",
          label: "pollIntervalMilliseconds",
          kind: "number",
          help: "How often to poll for tasks (ms).",
          placeholder: String(ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds)
        }
      ];
    case "hooks":
      return [
        {
          path: "defaults.hooks.prepareWorktree",
          label: "prepareWorktree",
          kind: "text",
          help: "Fallback only \u2014 a repo's own .groundcrew/config.json wins. Runs after worktree create, before launch."
        }
      ];
    case "git":
      return [
        {
          path: "git.remote",
          label: "remote",
          kind: "text",
          help: "Git remote name.",
          placeholder: GIT_DEFAULTS.remote
        },
        {
          path: "git.defaultBranch",
          label: "defaultBranch",
          kind: "text",
          help: "Branch worktrees fork from.",
          placeholder: GIT_DEFAULTS.defaultBranch
        },
        {
          path: "git.branchPrefix",
          label: "branchPrefix",
          kind: "text",
          help: "Branch name prefix. Defaults to your OS username."
        }
      ];
    case "sandbox":
      return [
        {
          path: "local.runner",
          label: "runner",
          kind: "select",
          options: RUNNERS,
          help: [
            "\u2022 auto \u2014 chooses for you (safehouse on macOS, sdx on Linux)",
            "\u2022 safehouse \u2014 macOS only",
            "\u2022 srt \u2014 Anthropic sandbox-runtime, fast & no Docker, macOS + Linux/WSL",
            "\u2022 sdx \u2014 Docker Sandboxes, needs Docker, macOS + Linux",
            "\u2022 none \u2014 no sandbox (unsafe)"
          ].join("\n")
        },
        {
          path: "local.networkEgress",
          label: "networkEgress",
          kind: "select",
          options: NETWORK_EGRESS,
          help: [
            "Network access for agents. Only the safehouse runner uses this; srt/sdx/none ignore it.",
            "\u2022 allowlisted \u2014 Clearance-wrapped: deny network except the egress allowlist (default)",
            "\u2022 open \u2014 keep the filesystem sandbox but open network egress (no Clearance)"
          ].join("\n")
        }
      ];
    case "prompts":
      return [
        {
          path: "prompts.initial",
          label: "initial",
          kind: "text",
          help: "Inline initial agent prompt. Mutually exclusive with promptFile. Supports {{task}}, {{title}}, {{description}}, {{worktree}}, {{workspaceContinuationInstruction}}."
        },
        {
          path: "prompts.promptFile",
          label: "promptFile",
          kind: "text",
          help: "Path to a file whose contents become the initial prompt. Resolved relative to the config dir; ~ expands. Mutually exclusive with initial."
        }
      ];
    case "terminal":
      return [
        {
          path: "workspaceKind",
          label: "workspaceKind",
          kind: "select",
          options: WORKSPACE_KINDS,
          help: "Terminal session manager. auto = cmux if present, else tmux."
        }
      ];
    case "advanced":
      return [
        {
          path: "logging.file",
          label: "logging.file",
          kind: "text",
          help: "Append-mode log file. Defaults to XDG state dir."
        }
      ];
    default:
      return [];
  }
}
function repoCount(draft) {
  return draft.workspace.knownRepositories?.length ?? 0;
}
function sectionSummary(id, draft) {
  switch (id) {
    case "workspace": {
      const { projectDir, worktreeDir } = draft.workspace;
      return `${projectDir} \xB7 worktreeDir: ${worktreeDir ?? projectDir}`;
    }
    case "repositories": {
      const n = repoCount(draft);
      return `${n} repo${n === 1 ? "" : "s"}`;
    }
    case "agents": {
      const defs = Object.keys(draft.agents?.definitions ?? {});
      return defs.length === 0 ? "none enabled" : `default: ${draft.agents?.default ?? "?"} \xB7 ${defs.join(", ")}`;
    }
    case "taskSources": {
      if (enabledSourceCount(draft) === 0) return "none \u2014 crew won't run";
      const kinds = [];
      if (isLinearEnabled(draft)) kinds.push("linear");
      if (isTodoTxtEnabled(draft)) kinds.push("todo-txt");
      if (isPlanKeeperEnabled(draft)) kinds.push("plan-keeper");
      kinds.push(...shellSourceNames(draft));
      return kinds.join(", ");
    }
    case "usage": {
      if (isUsageDisabled(draft.agents)) return "tracking disabled";
      const limit = draft.orchestrator?.sessionLimitPercentage ?? ORCHESTRATOR_DEFAULTS.sessionLimitPercentage;
      return `tracking enabled \xB7 limit ${limit}%`;
    }
    case "orchestrator": {
      const o = draft.orchestrator ?? {};
      const max = o.maximumInProgress ?? ORCHESTRATOR_DEFAULTS.maximumInProgress;
      const poll = (o.pollIntervalMilliseconds ?? ORCHESTRATOR_DEFAULTS.pollIntervalMilliseconds) / 1e3;
      return `max ${max} \xB7 poll ${poll}s`;
    }
    case "hooks":
      return draft.defaults?.hooks?.prepareWorktree ? `fallback: ${draft.defaults.hooks.prepareWorktree}` : "none (per-repo only)";
    case "git":
      return `${draft.git?.remote ?? GIT_DEFAULTS.remote} \xB7 ${draft.git?.defaultBranch ?? GIT_DEFAULTS.defaultBranch}`;
    case "sandbox":
      return `runner: ${draft.local?.runner ?? "auto"} \xB7 egress: ${draft.local?.networkEgress ?? "allowlisted"}`;
    case "prompts": {
      const prompts = draft.prompts ?? {};
      if (prompts.promptFile) return `file: ${prompts.promptFile}`;
      return prompts.initial ? `custom (${prompts.initial.length} chars)` : "default";
    }
    case "terminal":
      return `workspaceKind: ${draft.workspaceKind ?? "auto"}`;
    case "advanced":
      return draft.logging?.file ? `log: ${draft.logging.file}` : "defaults";
    default:
      return "";
  }
}

// src/domain/sectionRouting.ts
var SECTION_PREFIXES = [
  ["knownRepositories", "repositories"],
  ["workspaceKind", "terminal"],
  ["defaults.hooks", "hooks"],
  ["workspace", "workspace"],
  ["usage", "usage"],
  ["orchestrator.sessionLimitPercentage", "usage"],
  ["agents", "agents"],
  ["linear", "taskSources"],
  ["sources", "taskSources"],
  ["orchestrator", "orchestrator"],
  ["git", "git"],
  ["local", "sandbox"],
  ["prompts", "prompts"],
  ["logging", "advanced"]
];
function sectionForKeyPath(keyPath) {
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (containsSegment(keyPath, prefix)) return section;
  }
  return void 0;
}
function containsSegment(path11, segment) {
  if (segment.length > path11.length) return false;
  let from = 0;
  while (from <= path11.length - segment.length) {
    const idx = path11.indexOf(segment, from);
    if (idx === -1) return false;
    const before = idx === 0 ? "." : path11[idx - 1];
    const after = idx + segment.length === path11.length ? "." : path11[idx + segment.length];
    if ((before === "." || before === "[") && (after === "." || after === "[")) {
      return true;
    }
    from = idx + 1;
  }
  return false;
}

// src/domain/modified.ts
function modifiedSections(baseline, draft) {
  const out = /* @__PURE__ */ new Set();
  for (const path11 of changedPaths(baseline, draft)) {
    const section = sectionForKeyPath(path11);
    if (section !== void 0) out.add(section);
  }
  return out;
}
function modifiedByKey(current, baseline, keyOf) {
  if (baseline === void 0) return current.map(() => true);
  const byKey = /* @__PURE__ */ new Map();
  baseline.forEach((item, i) => byKey.set(keyOf(item, i), item));
  return current.map((item, i) => {
    const match = byKey.get(keyOf(item, i));
    return match === void 0 || !valuesEqual(item, match);
  });
}

// src/app.tsx
import path6 from "path";

// src/io/save.ts
import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import path2 from "path";

// src/domain/prune.ts
function isEmpty(value) {
  if (value === void 0) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}
function pruneValue(value) {
  if (Array.isArray(value)) {
    return value.map(pruneValue).filter((v) => !isEmpty(v));
  }
  if (isObject(value)) {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const pruned = pruneValue(raw);
      if (!isEmpty(pruned)) out[key] = pruned;
    }
    return out;
  }
  return value;
}
function pruneEmpty(draft) {
  const source = draft;
  const pruned = pruneValue(source);
  if ("workspace" in source) {
    const workspace = isObject(source.workspace) ? source.workspace : {};
    const prunedWorkspace = pruneValue(workspace);
    if ("knownRepositories" in workspace && !("knownRepositories" in prunedWorkspace)) {
      prunedWorkspace.knownRepositories = pruneValue(
        workspace.knownRepositories
      );
    }
    pruned.workspace = prunedWorkspace;
  }
  restoreAgentDefinitions(source, pruned);
  return pruned;
}
function restoreAgentDefinitions(draft, pruned) {
  const agents = draft.agents;
  if (!isObject(agents) || !isObject(agents.definitions)) return;
  const prunedAgents = isObject(pruned.agents) ? pruned.agents : {};
  const prunedDefinitions = isObject(prunedAgents.definitions) ? prunedAgents.definitions : {};
  for (const [name, definition] of Object.entries(agents.definitions)) {
    if (!(name in prunedDefinitions)) {
      prunedDefinitions[name] = pruneValue(definition);
    }
  }
  prunedAgents.definitions = prunedDefinitions;
  pruned.agents = prunedAgents;
}

// src/domain/xdg.ts
import { homedir } from "os";
import path from "path";
function xdgConfigDir() {
  const base = process.env.XDG_CONFIG_HOME;
  if (base !== void 0 && base.length > 0) {
    return path.join(base, "groundcrew");
  }
  return path.join(homedir(), ".config", "groundcrew");
}

// src/io/save.ts
var SHADOWING = ["crew.config.ts", "crew.config.mjs", "crew.config.js"];
function targetPath(target2) {
  const dir = target2.scope === "global" ? xdgConfigDir() : target2.cwd;
  return path2.join(dir, "crew.config.json");
}
async function saveDraft(target2, draft) {
  const out = targetPath(target2);
  const dir = path2.dirname(out);
  mkdirSync(dir, { recursive: true });
  const shadowed = [];
  for (const name of SHADOWING) {
    const candidate = path2.join(dir, name);
    if (existsSync(candidate)) {
      let backup = `${candidate}.bak`;
      let n = 1;
      while (existsSync(backup)) backup = `${candidate}.bak.${n++}`;
      renameSync(candidate, backup);
      shadowed.push(backup);
    }
  }
  const json = JSON.stringify(pruneEmpty(draft), void 0, 2);
  writeFileSync(out, `${json}
`);
  return { path: out, shadowed };
}

// src/io/validate.ts
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { existsSync as existsSync2, mkdtempSync, rmSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { tmpdir } from "os";
import path3 from "path";
import { promisify } from "util";
var run = promisify(execFile);
var groundcrewUrl = import.meta.resolve("@clipboard-health/groundcrew");
var CHILD = `
const { loadConfig } = await import(${JSON.stringify(groundcrewUrl)});
try { await loadConfig(); }
catch (error) { console.error(error?.message ?? String(error)); process.exit(1); }
`;
function mapSection(message) {
  const stripped = message.replace(/^groundcrew config:\s*/, "");
  const withoutPath = stripped.replace(
    /^(?:[A-Za-z]:)?[^\s:]*[\\/].*?:\s+/,
    ""
  );
  const keyPath = withoutPath.split(/\s/, 1)[0] ?? "";
  return sectionForKeyPath(keyPath);
}
async function validateDraft(draft, configDir) {
  const inPlace = configDir !== void 0 && existsSync2(configDir) && statSync(configDir).isDirectory();
  const dir = inPlace ? configDir : mkdtempSync(path3.join(tmpdir(), "cc-validate-"));
  const file = path3.join(dir, `.crew.config.validate-${randomUUID()}.json`);
  writeFileSync2(file, JSON.stringify(pruneEmpty(draft)));
  try {
    await run(process.execPath, ["--input-type=module", "-e", CHILD], {
      env: { ...process.env, GROUNDCREW_CONFIG: file }
    });
    return { ok: true };
  } catch (error) {
    const message = error.stderr?.trim() || String(error);
    return { ok: false, message, section: mapSection(message) };
  } finally {
    rmSync(file, { force: true });
    if (!inPlace) rmSync(dir, { recursive: true, force: true });
  }
}

// src/screens/Home.tsx
import { useRef } from "react";
import { Box as Box3, Text as Text3, useInput } from "ink";

// src/components/ScrollableList.tsx
import { Box as Box2, Text as Text2 } from "ink";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function computeWindow(count, cursor, maxVisible) {
  if (maxVisible <= 0 || maxVisible >= count) return { start: 0, end: count };
  const half = Math.floor(maxVisible / 2);
  const start = Math.max(0, Math.min(cursor - half, count - maxVisible));
  return { start, end: start + maxVisible };
}
function ScrollableList({ count, cursor, maxVisible, renderRow }) {
  const { start, end } = computeWindow(count, cursor, maxVisible);
  const rows = [];
  for (let index = start; index < end; index += 1) rows.push(renderRow(index));
  return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", children: [
    start > 0 ? /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: `  \u2191 ${start} more` }) : null,
    rows,
    end < count ? /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: `  \u2193 ${count - end} more` }) : null
  ] });
}
function visibleRows(terminalRows, reserve) {
  return Math.max(MIN_VISIBLE_ROWS, terminalRows - reserve);
}
var MIN_VISIBLE_ROWS = 4;

// src/screens/Home.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var HOME_CHROME_ROWS = 9;
function Home({
  draft,
  issues,
  modified,
  cursor,
  onCursorChange,
  onOpen
}) {
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const { rows: terminalRows } = useFullscreen();
  const maxVisible = visibleRows(terminalRows, HOME_CHROME_ROWS);
  function moveCursor(next) {
    cursorRef.current = next;
    onCursorChange(next);
  }
  useInput((_input, key) => {
    if (key.downArrow)
      moveCursor(Math.min(SECTION_ORDER.length - 1, cursorRef.current + 1));
    if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
    if (key.return) {
      const id = SECTION_ORDER[cursorRef.current];
      if (id) onOpen(id);
    }
  });
  function renderRow(index) {
    const id = SECTION_ORDER[index];
    const bad = issues.has(id);
    const edited = modified.has(id);
    return /* @__PURE__ */ jsxs3(Box3, { children: [
      /* @__PURE__ */ jsx3(Text3, { color: cursor === index ? "cyan" : void 0, children: cursor === index ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsx3(Box3, { width: 16, children: /* @__PURE__ */ jsx3(Text3, { color: cursor === index ? "cyan" : void 0, children: SECTION_LABEL[id] }) }),
      /* @__PURE__ */ jsxs3(Text3, { color: bad ? "yellow" : "green", children: [
        bad ? "\u26A0" : "\u2713",
        " "
      ] }),
      /* @__PURE__ */ jsx3(Text3, { dimColor: true, children: sectionSummary(id, draft) }),
      edited ? /* @__PURE__ */ jsx3(Text3, { color: "yellow", children: " (edited)" }) : null
    ] }, id);
  }
  return /* @__PURE__ */ jsx3(
    ScrollableList,
    {
      count: SECTION_ORDER.length,
      cursor,
      maxVisible,
      renderRow
    }
  );
}

// src/screens/AgentsForm.tsx
import { useState as useState5 } from "react";
import { Box as Box7, Text as Text7, useInput as useInput5 } from "ink";

// src/domain/agents.ts
var BUILTIN_AGENTS = ["claude", "codex"];
function isAgentEnabled(agents, name) {
  return Object.hasOwn(agents?.definitions ?? {}, name);
}
function setAgentEnabled(agents, name, enabled) {
  const definitions = { ...agents?.definitions ?? {} };
  if (enabled) {
    if (!(name in definitions)) definitions[name] = {};
  } else {
    delete definitions[name];
  }
  return { ...agents, definitions };
}
function getAgentDef(agents, name) {
  const def = (agents?.definitions ?? {})[name];
  return isObject(def) ? def : {};
}
function setAgentDef(agents, name, def) {
  const definitions = { ...agents?.definitions ?? {} };
  definitions[name] = def;
  return { ...agents, definitions };
}
function asString2(value) {
  return typeof value === "string" ? value : "";
}
function readAgentFields(def) {
  const sandbox = def.sandbox;
  const env = Array.isArray(def.preLaunchEnv) ? def.preLaunchEnv.filter((n) => typeof n === "string").join(", ") : "";
  return {
    cmd: asString2(def.cmd),
    color: asString2(def.color),
    preLaunch: asString2(def.preLaunch),
    preLaunchEnv: env,
    sandboxAgent: asString2(sandbox?.agent)
  };
}
function applyAgentFields(def, fields) {
  const next = { ...def };
  for (const key of ["cmd", "color", "preLaunch"]) {
    if (fields[key].length === 0) delete next[key];
    else next[key] = fields[key];
  }
  const env = fields.preLaunchEnv.split(",").map((n) => n.trim()).filter((n) => n.length > 0);
  if (env.length === 0) delete next.preLaunchEnv;
  else next.preLaunchEnv = env;
  const sandboxAgent = fields.sandboxAgent.trim();
  if (sandboxAgent.length === 0) delete next.sandbox;
  else next.sandbox = { agent: sandboxAgent };
  return next;
}
function runnerRequiresSandbox(runner, platform = process.platform) {
  if (runner === "sdx") return true;
  return (runner === void 0 || runner === "auto") && platform === "linux";
}

// src/domain/permissions.ts
var CLAUDE_DEFAULT_CMD = "claude --permission-mode auto";
function effectiveCmd(name, def) {
  const cmd = def.cmd;
  if (typeof cmd === "string" && cmd.length > 0) return cmd;
  if (name === "claude") return CLAUDE_DEFAULT_CMD;
  return void 0;
}
function applyPermissionMode(cmd, mode) {
  const stripped = cmd.replace(/--permission-mode(?:=|\s+)\S+/g, "").trim().replace(/\s{2,}/g, " ");
  return `${stripped} --permission-mode ${mode}`.trim();
}
function isBypassEnabled(name, def) {
  const cmd = effectiveCmd(name, def ?? {});
  if (cmd === void 0) return false;
  return /--permission-mode\s+bypassPermissions\b/.test(cmd);
}
function setBypass(agents, name, enabled) {
  const definitions = { ...agents?.definitions ?? {} };
  const def = { ...definitions[name] ?? {} };
  const base = effectiveCmd(name, def) ?? CLAUDE_DEFAULT_CMD;
  const mode = enabled ? "bypassPermissions" : "auto";
  def.cmd = applyPermissionMode(base, mode);
  definitions[name] = def;
  return { ...agents, definitions };
}

// src/screens/AgentSubForm.tsx
import { useState as useState4 } from "react";
import { Box as Box6, Text as Text6, useInput as useInput4 } from "ink";

// src/components/TextField.tsx
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import { Box as Box4, Text as Text4, useInput as useInput2 } from "ink";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var VALUE_INDENT = 4;
function TextField({
  label,
  value,
  isActive,
  onChange,
  placeholder,
  disabled = false,
  disabledHint,
  modified = false
}) {
  const [caret, setCaret] = useState2(value.length);
  const caretRef = useRef2(value.length);
  function moveCaret(next) {
    caretRef.current = next;
    setCaret(next);
  }
  useEffect2(() => {
    if (isActive && !disabled) moveCaret(value.length);
  }, [isActive, disabled]);
  useInput2(
    (input, key) => {
      const pos2 = Math.min(caretRef.current, value.length);
      if (key.leftArrow) {
        moveCaret(Math.max(0, pos2 - 1));
        return;
      }
      if (key.rightArrow) {
        moveCaret(Math.min(value.length, pos2 + 1));
        return;
      }
      if (key.backspace || key.delete) {
        if (pos2 === 0) return;
        onChange(value.slice(0, pos2 - 1) + value.slice(pos2));
        moveCaret(pos2 - 1);
        return;
      }
      if (key.return || key.upArrow || key.downArrow || key.escape || key.tab)
        return;
      if (input) {
        onChange(value.slice(0, pos2) + input + value.slice(pos2));
        moveCaret(pos2 + input.length);
      }
    },
    { isActive: isActive && !disabled }
  );
  const labelRow = /* @__PURE__ */ jsxs4(Box4, { children: [
    /* @__PURE__ */ jsxs4(Text4, { color: isActive ? "cyan" : void 0, children: [
      isActive ? "\u203A " : "  ",
      label,
      " "
    ] }),
    modified ? /* @__PURE__ */ jsx4(Text4, { color: "yellow", children: "\u25CF" }) : null
  ] });
  if (disabled) {
    return /* @__PURE__ */ jsxs4(Box4, { flexDirection: "column", children: [
      labelRow,
      /* @__PURE__ */ jsx4(Box4, { paddingLeft: VALUE_INDENT, children: /* @__PURE__ */ jsx4(Text4, { dimColor: true, children: disabledHint ?? "(disabled)" }) })
    ] });
  }
  const hasValue = value.length > 0;
  const pos = Math.min(caret, value.length);
  const endBar = isActive ? /* @__PURE__ */ jsx4(Text4, { color: "cyan", children: "\u258F" }) : null;
  const atEnd = pos >= value.length;
  return /* @__PURE__ */ jsxs4(Box4, { flexDirection: "column", children: [
    labelRow,
    /* @__PURE__ */ jsx4(Box4, { paddingLeft: VALUE_INDENT, children: !hasValue ? /* @__PURE__ */ jsxs4(Text4, { children: [
      endBar,
      /* @__PURE__ */ jsx4(Text4, { dimColor: true, children: placeholder ?? "" })
    ] }) : atEnd ? /* @__PURE__ */ jsxs4(Text4, { children: [
      value,
      endBar
    ] }) : /* @__PURE__ */ jsxs4(Text4, { children: [
      value.slice(0, pos),
      /* @__PURE__ */ jsx4(Text4, { inverse: isActive, children: value[pos] }),
      value.slice(pos + 1)
    ] }) })
  ] });
}

// src/hooks/useEditGuard.ts
import { useRef as useRef3, useState as useState3 } from "react";
function useEditGuard() {
  const dirtyRef = useRef3(false);
  const [guarding, setGuarding] = useState3(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };
  return {
    guarding,
    track: (set) => (value) => {
      markDirty();
      set(value);
    },
    markDirty,
    requestCancel: (onCancel) => {
      if (dirtyRef.current) setGuarding(true);
      else onCancel();
    },
    keepEditing: () => setGuarding(false)
  };
}

// src/screens/SaveGuard.tsx
import { Box as Box5, Text as Text5, useInput as useInput3 } from "ink";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function SaveGuard({ onApply, onDiscard, onCancel }) {
  useInput3((input, key) => {
    if (input === "a") onApply();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return /* @__PURE__ */ jsxs5(Box5, { flexDirection: "column", borderStyle: "double", paddingX: 2, paddingY: 1, children: [
    /* @__PURE__ */ jsx5(Text5, { children: "Save these edits to current draft config? (will not save to disk)" }),
    /* @__PURE__ */ jsx5(Box5, { marginTop: 1, children: /* @__PURE__ */ jsx5(Text5, { dimColor: true, children: "[a] Apply [d] Discard [esc] Keep editing" }) })
  ] });
}

// src/screens/AgentSubForm.tsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var ROWS = [
  { key: "cmd", label: "cmd", placeholder: "agent-native launch command" },
  { key: "color", label: "color", placeholder: "#C15F3C" },
  { key: "preLaunch", label: "preLaunch", placeholder: "shell run before launch (optional)" },
  { key: "preLaunchEnv", label: "preLaunchEnv", placeholder: "comma-separated env names" },
  { key: "sandboxAgent", label: "sandbox.agent", placeholder: "sbx agent name" }
];
function AgentSubForm({
  name,
  def,
  baselineDef,
  sandboxRequired,
  onSave,
  onCancel
}) {
  const [fields, setFields] = useState4(() => readAgentFields(def));
  const baselineFields = readAgentFields(baselineDef ?? {});
  const [active, setActive] = useState4(0);
  const guard = useEditGuard();
  useInput4(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) setActive((a) => Math.min(ROWS.length - 1, a + 1));
      if (key.upArrow) setActive((a) => Math.max(0, a - 1));
      if (key.return) onSave(applyAgentFields(def, fields));
    },
    { isActive: !guard.guarding }
  );
  if (guard.guarding) {
    return /* @__PURE__ */ jsx6(
      SaveGuard,
      {
        onApply: () => onSave(applyAgentFields(def, fields)),
        onDiscard: onCancel,
        onCancel: guard.keepEditing
      }
    );
  }
  const sandboxMissing = sandboxRequired && fields.sandboxAgent.trim().length === 0;
  return /* @__PURE__ */ jsxs6(Box6, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsxs6(Text6, { bold: true, children: [
      "Agent: ",
      name
    ] }),
    /* @__PURE__ */ jsx6(Box6, { flexDirection: "column", marginTop: 1, children: ROWS.map((rowField, index) => {
      const modified = baselineDef === void 0 || !valuesEqual(fields[rowField.key], baselineFields[rowField.key]);
      return /* @__PURE__ */ jsx6(
        TextField,
        {
          label: rowField.label,
          value: fields[rowField.key],
          placeholder: rowField.key === "sandboxAgent" && sandboxRequired ? "required for runner: sdx" : rowField.placeholder,
          isActive: active === index,
          modified,
          onChange: (v) => {
            guard.markDirty();
            setFields((f) => ({ ...f, [rowField.key]: v }));
          }
        },
        rowField.key
      );
    }) }),
    sandboxMissing ? /* @__PURE__ */ jsx6(Box6, { marginTop: 1, children: /* @__PURE__ */ jsx6(Text6, { color: "yellow", children: "\u26A0 runner resolves to sdx \u2014 sandbox.agent is required or launch fails." }) }) : null,
    /* @__PURE__ */ jsx6(Box6, { marginTop: 1, children: /* @__PURE__ */ jsx6(Text6, { dimColor: true, children: "Fine-tune how this agent launches \u2014 most people can leave these blank. Blank fields inherit the built-in preset. \u2191/\u2193 move \xB7 type to edit \xB7 enter apply \xB7 esc cancel." }) })
  ] });
}

// src/screens/AgentsForm.tsx
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
function AgentsForm({ draft, baseline, onChange, onBack }) {
  const [cursor, setCursor] = useState5(0);
  const [editing, setEditing] = useState5(void 0);
  const agents = draft.agents ?? {};
  const definitions = agents.definitions ?? {};
  const baseAgents = baseline.agents ?? {};
  const baseDefinitions = baseAgents.definitions ?? {};
  const claudeOn = isAgentEnabled(agents, "claude");
  const sandboxRequired = runnerRequiresSandbox(draft.local?.runner);
  const rows = [];
  rows.push({ kind: "enable", name: "claude" });
  if (claudeOn) rows.push({ kind: "bypass" });
  rows.push({ kind: "enable", name: "codex" });
  const focused = Math.min(cursor, rows.length - 1);
  const custom = Object.keys(definitions).filter(
    (name) => !BUILTIN_AGENTS.includes(name)
  );
  function toggle(row) {
    if (row.kind === "enable") {
      onChange({
        ...draft,
        agents: setAgentEnabled(agents, row.name, !isAgentEnabled(agents, row.name))
      });
    } else {
      onChange({
        ...draft,
        agents: setBypass(agents, "claude", !isBypassEnabled("claude", definitions.claude))
      });
    }
  }
  useInput5(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (key.return) {
        const row = rows[focused];
        if (row?.kind === "enable") setEditing(row.name);
        return;
      }
      if (key.downArrow) setCursor(Math.min(rows.length - 1, focused + 1));
      if (key.upArrow) setCursor(Math.max(0, focused - 1));
      if (input === " ") {
        const row = rows[focused];
        if (row) toggle(row);
      }
    },
    { isActive: editing === void 0 }
  );
  if (editing !== void 0) {
    return /* @__PURE__ */ jsx7(
      AgentSubForm,
      {
        name: editing,
        def: getAgentDef(agents, editing),
        baselineDef: Object.hasOwn(baseDefinitions, editing) ? getAgentDef(baseAgents, editing) : void 0,
        sandboxRequired,
        onSave: (def) => {
          onChange({ ...draft, agents: setAgentDef(agents, editing, def) });
          setEditing(void 0);
        },
        onCancel: () => setEditing(void 0)
      }
    );
  }
  return /* @__PURE__ */ jsxs7(Box7, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx7(Text7, { bold: true, children: "Agents" }),
    /* @__PURE__ */ jsx7(Box7, { marginTop: 1, flexDirection: "column", children: rows.map((row, index) => {
      const active = index === focused;
      const marker = active ? "\u25B8 " : "  ";
      if (row.kind === "enable") {
        const on2 = isAgentEnabled(agents, row.name);
        const baseOn = isAgentEnabled(baseAgents, row.name);
        const modified2 = on2 !== baseOn || !valuesEqual(definitions[row.name], baseDefinitions[row.name]);
        return /* @__PURE__ */ jsxs7(Text7, { color: active ? "cyan" : void 0, children: [
          marker,
          /* @__PURE__ */ jsxs7(Text7, { color: on2 ? "green" : void 0, children: [
            "[",
            on2 ? "x" : " ",
            "]"
          ] }),
          " ",
          row.name,
          modified2 ? /* @__PURE__ */ jsx7(Text7, { color: "yellow", children: " \u25CF" }) : null
        ] }, row.name);
      }
      const on = isBypassEnabled("claude", definitions.claude);
      const baseBypass = isBypassEnabled("claude", baseDefinitions.claude);
      const modified = on !== baseBypass;
      return /* @__PURE__ */ jsxs7(Text7, { color: active ? "cyan" : void 0, children: [
        marker,
        "    ",
        /* @__PURE__ */ jsxs7(Text7, { color: on ? "green" : void 0, children: [
          "[",
          on ? "x" : " ",
          "]"
        ] }),
        " ",
        "bypass permission prompts",
        modified ? /* @__PURE__ */ jsx7(Text7, { color: "yellow", children: " \u25CF" }) : null
      ] }, "bypass");
    }) }),
    custom.length > 0 ? /* @__PURE__ */ jsx7(Box7, { marginTop: 1, flexDirection: "column", children: custom.map((name) => /* @__PURE__ */ jsxs7(Text7, { dimColor: true, children: [
      name,
      " \u2014 defined in crew.config.json"
    ] }, name)) }) : null,
    /* @__PURE__ */ jsx7(Box7, { marginTop: 1, children: /* @__PURE__ */ jsx7(Text7, { dimColor: true, children: 'The AI coding tools groundcrew runs on your tasks (e.g. Claude, Codex). Check the ones installed on your machine. "bypass permission prompts" lets the agent act without stopping to ask. \u2191/\u2193 move \xB7 space toggle \xB7 enter edit fields \xB7 esc back.' }) })
  ] });
}

// src/screens/PromptsScreen.tsx
import { useRef as useRef6, useState as useState8 } from "react";
import { Box as Box10, Text as Text10, useInput as useInput8 } from "ink";

// src/domain/draftPath.ts
function getByPath(draft, path11) {
  let current = draft;
  for (const key of path11.split(".")) {
    if (!isObject(current)) return void 0;
    current = current[key];
  }
  return current;
}
function setByPath(draft, path11, value) {
  const keys = path11.split(".");
  const [head, ...rest] = keys;
  if (head === void 0) return draft;
  const clone = { ...draft };
  if (rest.length === 0) {
    if (value === void 0) delete clone[head];
    else clone[head] = value;
  } else {
    const child = isObject(clone[head]) ? clone[head] : {};
    clone[head] = setByPath(child, rest.join("."), value);
  }
  return clone;
}

// src/screens/PromptsBrowser.tsx
import { useMemo, useRef as useRef5, useState as useState7 } from "react";
import { Box as Box9, Text as Text9, useInput as useInput7 } from "ink";

// src/prompts/install.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync3 } from "fs";
import path4 from "path";
function installPrompt(draft, configDir, prompt) {
  const promptsDir = path4.join(configDir, "prompts");
  mkdirSync2(promptsDir, { recursive: true });
  const absolutePath = path4.join(promptsDir, `${prompt.slug}.md`);
  const body = prompt.body.endsWith("\n") ? prompt.body : `${prompt.body}
`;
  writeFileSync3(absolutePath, body);
  const relativePath = `prompts/${prompt.slug}.md`;
  const cleared = setByPath(
    draft,
    "prompts.initial",
    void 0
  );
  const next = setByPath(cleared, "prompts.promptFile", relativePath);
  return {
    draft: next,
    absolutePath,
    relativePath
  };
}

// src/prompts/loader.ts
import { readdirSync, readFileSync } from "fs";
import path5 from "path";
import { fileURLToPath } from "url";
var PROMPTS_DIR = fileURLToPath(new URL("./", import.meta.url));
function listPackagedPrompts(dir = PROMPTS_DIR) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
  return files.map((name) => readPackagedPrompt(path5.join(dir, name)));
}
function readPackagedPrompt(filepath) {
  const raw = readFileSync(filepath, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const slug = path5.basename(filepath, ".md");
  return {
    slug,
    title: frontmatter.title ?? slug,
    description: frontmatter.description ?? "",
    body
  };
}
function parseFrontmatter(text) {
  const fence = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fence) return { frontmatter: {}, body: text };
  const fm = fence[1] ?? "";
  const body = text.slice(fence[0].length);
  const frontmatter = {};
  for (const line of fm.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2];
    if (key === void 0 || rawValue === void 0) continue;
    frontmatter[key] = unquote(rawValue.trim());
  }
  return { frontmatter, body };
}
function unquote(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if (first === '"' && last === '"' || first === "'" && last === "'") {
    return value.slice(1, -1);
  }
  return value;
}

// src/screens/PromptsReader.tsx
import { useRef as useRef4, useState as useState6 } from "react";
import { Box as Box8, Text as Text8, useInput as useInput6 } from "ink";
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var CHROME_ROWS = 8;
var MIN_VISIBLE = 4;
function PromptsReader({ prompt, onInstall, onBack }) {
  const { rows: terminalRows } = useFullscreen();
  const lines = prompt.body.split("\n");
  const visible = Math.max(MIN_VISIBLE, terminalRows - CHROME_ROWS);
  const maxTop = Math.max(0, lines.length - visible);
  const [scrollTop, setScrollTop] = useState6(0);
  const scrollRef = useRef4(0);
  function moveScroll(next) {
    const clamped = Math.max(0, Math.min(maxTop, next));
    scrollRef.current = clamped;
    setScrollTop(clamped);
  }
  useInput6((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "i") {
      onInstall();
      return;
    }
    if (key.downArrow) moveScroll(scrollRef.current + 1);
    if (key.upArrow) moveScroll(scrollRef.current - 1);
    if (key.pageDown || input === " ") moveScroll(scrollRef.current + visible);
    if (key.pageUp || input === "b") moveScroll(scrollRef.current - visible);
    if (input === "g") moveScroll(0);
    if (input === "G") moveScroll(maxTop);
  });
  const end = Math.min(lines.length, scrollTop + visible);
  const above = scrollTop;
  const below = lines.length - end;
  const slice = lines.slice(scrollTop, end);
  return /* @__PURE__ */ jsxs8(Box8, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx8(Text8, { bold: true, children: prompt.title }),
    prompt.description ? /* @__PURE__ */ jsx8(Box8, { marginTop: 1, children: /* @__PURE__ */ jsx8(Text8, { dimColor: true, children: prompt.description }) }) : null,
    /* @__PURE__ */ jsxs8(Box8, { marginTop: 1, flexDirection: "column", children: [
      above > 0 ? /* @__PURE__ */ jsx8(Text8, { dimColor: true, children: `\u2191 ${above} more line${above === 1 ? "" : "s"}` }) : null,
      slice.map((line, index) => /* @__PURE__ */ jsx8(Text8, { children: line === "" ? " " : line }, scrollTop + index)),
      below > 0 ? /* @__PURE__ */ jsx8(Text8, { dimColor: true, children: `\u2193 ${below} more line${below === 1 ? "" : "s"}` }) : null
    ] }),
    /* @__PURE__ */ jsx8(Box8, { marginTop: 1, children: /* @__PURE__ */ jsx8(Text8, { dimColor: true, children: "\u2191/\u2193 scroll \xB7 space/b page \xB7 g/G top/bottom \xB7 i install \xB7 esc back" }) })
  ] });
}

// src/screens/PromptsBrowser.tsx
import { jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
function PromptsBrowser({
  draft,
  configDir,
  onInstalled,
  onBack
}) {
  const { prompts, error: listError } = useMemo(() => safeList(), []);
  const [cursor, setCursor] = useState7(0);
  const cursorRef = useRef5(0);
  const [mode, setMode] = useState7("list");
  const [error, setError] = useState7(void 0);
  function moveCursor(next) {
    cursorRef.current = next;
    setCursor(next);
  }
  function install(prompt) {
    try {
      const result = installPrompt(draft, configDir, prompt);
      onInstalled(result.draft, result.relativePath);
    } catch (e) {
      setError(e.message);
      setMode("list");
    }
  }
  useInput7(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (prompts.length === 0) return;
      if (key.downArrow)
        moveCursor(Math.min(prompts.length - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return || input === "v") setMode("reader");
      if (input === "i") {
        const focused = prompts[cursorRef.current];
        if (focused) install(focused);
      }
    },
    { isActive: mode === "list" }
  );
  if (mode === "reader") {
    const focused = prompts[cursor];
    if (!focused) {
      setMode("list");
      return null;
    }
    return /* @__PURE__ */ jsx9(
      PromptsReader,
      {
        prompt: focused,
        onInstall: () => install(focused),
        onBack: () => setMode("list")
      }
    );
  }
  return /* @__PURE__ */ jsxs9(Box9, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx9(Text9, { bold: true, children: "Packaged prompts" }),
    listError ? /* @__PURE__ */ jsx9(Box9, { marginTop: 1, children: /* @__PURE__ */ jsxs9(Text9, { color: "red", children: [
      "Could not load packaged prompts: ",
      listError
    ] }) }) : prompts.length === 0 ? /* @__PURE__ */ jsx9(Box9, { marginTop: 1, children: /* @__PURE__ */ jsx9(Text9, { dimColor: true, children: "No packaged prompts found." }) }) : /* @__PURE__ */ jsx9(Box9, { flexDirection: "column", marginTop: 1, children: prompts.map((p, index) => /* @__PURE__ */ jsxs9(Box9, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs9(Text9, { color: cursor === index ? "cyan" : void 0, children: [
        cursor === index ? "\u25B8 " : "  ",
        /* @__PURE__ */ jsx9(Text9, { bold: true, children: p.title })
      ] }),
      p.description ? /* @__PURE__ */ jsx9(Box9, { marginLeft: 2, children: /* @__PURE__ */ jsx9(Text9, { dimColor: true, children: p.description }) }) : null
    ] }, p.slug)) }),
    error ? /* @__PURE__ */ jsx9(Box9, { marginTop: 1, children: /* @__PURE__ */ jsxs9(Text9, { color: "red", children: [
      "Install failed: ",
      error
    ] }) }) : null,
    /* @__PURE__ */ jsxs9(Box9, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsxs9(Text9, { dimColor: true, children: [
        "Each entry is a pre-written initial prompt. Installing one writes it under ",
        configDir,
        "/prompts/ and points promptFile at it."
      ] }),
      /* @__PURE__ */ jsx9(Text9, { dimColor: true, children: "\u2191/\u2193 select \xB7 i install \xB7 v/enter view \xB7 esc back" })
    ] })
  ] });
}
function safeList() {
  try {
    return { prompts: listPackagedPrompts() };
  } catch (e) {
    const err = e;
    if (err.code === "ENOENT") return { prompts: [] };
    return { prompts: [], error: err.message };
  }
}

// src/screens/PromptsScreen.tsx
import { jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
var ROW_COUNT = 3;
var INITIAL_ROW = 0;
var PROMPT_FILE_ROW = 1;
var BROWSE_ROW = 2;
function asString3(value) {
  return value === void 0 ? "" : String(value);
}
function PromptsScreen({
  draft,
  baseline,
  onChange,
  onBack,
  configDir
}) {
  const [mode, setMode] = useState8("form");
  const [cursor, setCursor] = useState8(0);
  const cursorRef = useRef6(0);
  const [installed, setInstalled] = useState8(void 0);
  function moveCursor(next) {
    cursorRef.current = next;
    setCursor(next);
  }
  useInput8(
    (_input, key) => {
      if (mode !== "form") return;
      if (key.escape) {
        onBack();
        return;
      }
      if (key.downArrow)
        moveCursor(Math.min(ROW_COUNT - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return && cursorRef.current === BROWSE_ROW) setMode("browse");
    },
    { isActive: mode === "form" }
  );
  function update(path11, raw) {
    const value = raw.length === 0 ? void 0 : raw;
    onChange(
      setByPath(
        draft,
        path11,
        value
      )
    );
  }
  if (mode === "browse") {
    return /* @__PURE__ */ jsx10(
      PromptsBrowser,
      {
        draft,
        configDir,
        onInstalled: (next, relativePath) => {
          onChange(next);
          setInstalled(relativePath);
          setMode("form");
          moveCursor(PROMPT_FILE_ROW);
        },
        onBack: () => setMode("form")
      }
    );
  }
  return /* @__PURE__ */ jsxs10(Box10, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx10(Text10, { bold: true, children: "Prompts" }),
    /* @__PURE__ */ jsxs10(Box10, { flexDirection: "column", marginTop: 1, children: [
      /* @__PURE__ */ jsx10(
        TextField,
        {
          label: "initial",
          value: asString3(getByPath(draft, "prompts.initial")),
          isActive: cursor === INITIAL_ROW,
          modified: !valuesEqual(
            getByPath(baseline, "prompts.initial"),
            getByPath(draft, "prompts.initial")
          ),
          onChange: (v) => update("prompts.initial", v)
        }
      ),
      /* @__PURE__ */ jsx10(
        TextField,
        {
          label: "promptFile",
          value: asString3(getByPath(draft, "prompts.promptFile")),
          isActive: cursor === PROMPT_FILE_ROW,
          modified: !valuesEqual(
            getByPath(baseline, "prompts.promptFile"),
            getByPath(draft, "prompts.promptFile")
          ),
          onChange: (v) => update("prompts.promptFile", v)
        }
      ),
      /* @__PURE__ */ jsx10(Box10, { children: /* @__PURE__ */ jsxs10(Text10, { color: cursor === BROWSE_ROW ? "cyan" : void 0, children: [
        cursor === BROWSE_ROW ? "\u203A " : "  ",
        "Browse packaged prompts \u2192"
      ] }) })
    ] }),
    installed ? /* @__PURE__ */ jsx10(Box10, { marginTop: 1, children: /* @__PURE__ */ jsxs10(Text10, { color: "green", children: [
      "Installed \u2192 promptFile = ",
      installed
    ] }) }) : null,
    /* @__PURE__ */ jsxs10(Box10, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx10(Text10, { dimColor: true, children: "The instructions groundcrew gives the agent at the start of every task. `initial` and `promptFile` are mutually exclusive \u2014 installing a packaged prompt sets `promptFile` and clears `initial`." }),
      /* @__PURE__ */ jsx10(Text10, { dimColor: true, children: "\u2191/\u2193 move \xB7 type to edit \xB7 enter on browse \xB7 esc back" })
    ] })
  ] });
}

// src/screens/QuitGuard.tsx
import { Box as Box11, Text as Text11, useInput as useInput9 } from "ink";
import { jsx as jsx11, jsxs as jsxs11 } from "react/jsx-runtime";
function QuitGuard({ onSaveQuit, onDiscard, onCancel }) {
  useInput9((input, key) => {
    if (input === "s") onSaveQuit();
    if (input === "d") onDiscard();
    if (key.escape) onCancel();
  });
  return /* @__PURE__ */ jsxs11(Box11, { flexDirection: "column", borderStyle: "double", paddingX: 2, paddingY: 1, children: [
    /* @__PURE__ */ jsx11(Text11, { bold: true, children: "Unsaved changes" }),
    /* @__PURE__ */ jsx11(Box11, { marginTop: 1, children: /* @__PURE__ */ jsx11(Text11, { children: "Save before quitting?" }) }),
    /* @__PURE__ */ jsx11(Box11, { marginTop: 1, children: /* @__PURE__ */ jsx11(Text11, { dimColor: true, children: "[s] Save & quit [d] Discard [esc] Cancel" }) })
  ] });
}

// src/screens/RepositoriesForm.tsx
import { useState as useState11 } from "react";
import { Box as Box15, Text as Text15, useInput as useInput13 } from "ink";

// src/components/ListField.tsx
import { useRef as useRef7, useState as useState9 } from "react";
import { Box as Box12, Text as Text12, useInput as useInput10 } from "ink";
import { jsx as jsx12, jsxs as jsxs12 } from "react/jsx-runtime";
var LIST_CHROME_ROWS = 11;
function ListField({
  items,
  isActive,
  onActivate,
  onDelete,
  addLabel = "+ add repository\u2026",
  itemActions
}) {
  const [cursor, setCursor] = useState9(0);
  const cursorRef = useRef7(0);
  const { rows: terminalRows } = useFullscreen();
  const rows = items.length + 1;
  const maxVisible = visibleRows(terminalRows, LIST_CHROME_ROWS);
  function moveCursor(next) {
    cursorRef.current = next;
    setCursor(next);
  }
  useInput10(
    (input, key) => {
      if (key.downArrow) moveCursor(Math.min(rows - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) onActivate(cursorRef.current);
      if (input === "d" && cursorRef.current < items.length) {
        onDelete(cursorRef.current);
        return;
      }
      if (cursorRef.current < items.length) {
        const action = itemActions?.find((a) => a.key === input);
        if (action) action.onPress(cursorRef.current);
      }
    },
    { isActive }
  );
  function renderRow(index) {
    if (index === items.length) {
      return /* @__PURE__ */ jsxs12(
        Text12,
        {
          color: isActive && cursor === items.length ? "cyan" : void 0,
          dimColor: true,
          children: [
            isActive && cursor === items.length ? "\u25B8 " : "  ",
            addLabel
          ]
        },
        "add"
      );
    }
    const item = items[index];
    return /* @__PURE__ */ jsxs12(Box12, { children: [
      /* @__PURE__ */ jsxs12(Text12, { color: isActive && cursor === index ? "cyan" : void 0, children: [
        isActive && cursor === index ? "\u25B8 " : "  ",
        item.label
      ] }),
      item.note ? /* @__PURE__ */ jsxs12(Text12, { dimColor: true, children: [
        " ",
        item.note
      ] }) : null,
      item.error ? /* @__PURE__ */ jsxs12(Text12, { color: "yellow", children: [
        " \u26A0 ",
        item.error
      ] }) : null,
      item.modified ? /* @__PURE__ */ jsx12(Text12, { color: "yellow", children: " \u25CF" }) : null
    ] }, index);
  }
  return /* @__PURE__ */ jsx12(Box12, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: /* @__PURE__ */ jsx12(
    ScrollableList,
    {
      count: rows,
      cursor,
      maxVisible,
      renderRow
    }
  ) });
}

// src/domain/repoEntries.ts
function normalizeRepos(repos) {
  return (repos ?? []).map(
    (entry) => typeof entry === "string" ? { name: entry, projectDirOverride: void 0 } : {
      name: entry.name,
      projectDirOverride: entry.projectDirOverride,
      workdir: entry.workdir,
      provision: entry.provision ? { create: entry.provision.create, remove: entry.provision.remove } : void 0,
      prepareWorktreeHook: entry.hooks?.prepareWorktree
    }
  );
}
function denormalizeRepos(entries) {
  return entries.map((entry) => {
    const name = entry.name.trim();
    const override = entry.projectDirOverride?.trim();
    const workdir = entry.workdir?.trim();
    const create = entry.provision?.create.trim() ?? "";
    const remove = entry.provision?.remove.trim() ?? "";
    const prepareHook = entry.prepareWorktreeHook?.trim() ?? "";
    const hasOverride = override !== void 0 && override.length > 0;
    const hasWorkdir = workdir !== void 0 && workdir.length > 0;
    const hasProvision = create.length > 0 || remove.length > 0;
    const hasHook = prepareHook.length > 0;
    if (!hasOverride && !hasWorkdir && !hasProvision && !hasHook) {
      return name;
    }
    const repo = { name };
    if (hasOverride) repo.projectDirOverride = override;
    if (hasWorkdir) repo.workdir = workdir;
    if (hasProvision) repo.provision = { create, remove };
    if (hasHook) repo.hooks = { prepareWorktree: prepareHook };
    return repo;
  });
}
function uniqueRepoName(base, existing) {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  const first = `${base}-copy`;
  if (!taken.has(first)) return first;
  for (let n = 2; ; n++) {
    const candidate = `${base}-copy-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
function duplicateEntry(entry, existingNames) {
  return {
    name: uniqueRepoName(entry.name, existingNames),
    projectDirOverride: entry.projectDirOverride,
    workdir: entry.workdir,
    provision: entry.provision ? { create: entry.provision.create, remove: entry.provision.remove } : void 0,
    prepareWorktreeHook: entry.prepareWorktreeHook
  };
}
function repoErrors(entries) {
  const seen = /* @__PURE__ */ new Set();
  return entries.map((entry) => {
    const name = entry.name.trim();
    if (name.length === 0) return "name is required";
    const duplicate = seen.has(name);
    seen.add(name);
    if (duplicate) return "duplicate repository name";
    const hasOverride = (entry.projectDirOverride?.trim().length ?? 0) > 0;
    const hasProvision = (entry.provision?.create.trim().length ?? 0) > 0 || (entry.provision?.remove.trim().length ?? 0) > 0;
    if (hasOverride && hasProvision) {
      return "projectDirOverride can't be combined with provision";
    }
    return void 0;
  });
}

// src/screens/RepoSubForm.tsx
import { useState as useState10 } from "react";
import { Box as Box13, Text as Text13, useInput as useInput11 } from "ink";
import { jsx as jsx13, jsxs as jsxs13 } from "react/jsx-runtime";
var FIELD_COUNT = 6;
function RepoSubForm({
  entry,
  baselineEntry,
  projectDir,
  onSave,
  onCancel
}) {
  const [name, setName] = useState10(entry.name);
  const [override, setOverride] = useState10(entry.projectDirOverride ?? "");
  const [workdir, setWorkdir] = useState10(entry.workdir ?? "");
  const [provisionCreate, setProvisionCreate] = useState10(
    entry.provision?.create ?? ""
  );
  const [provisionRemove, setProvisionRemove] = useState10(
    entry.provision?.remove ?? ""
  );
  const [prepareHook, setPrepareHook] = useState10(entry.prepareWorktreeHook ?? "");
  const [active, setActive] = useState10(0);
  const guard = useEditGuard();
  const nameModified = baselineEntry === void 0 || !valuesEqual(name, baselineEntry.name);
  const overrideModified = baselineEntry === void 0 || !valuesEqual(
    override.length === 0 ? void 0 : override,
    baselineEntry.projectDirOverride
  );
  const workdirModified = baselineEntry === void 0 || !valuesEqual(
    workdir.length === 0 ? void 0 : workdir,
    baselineEntry.workdir
  );
  const provisionCreateModified = baselineEntry === void 0 || !valuesEqual(provisionCreate, baselineEntry.provision?.create ?? "");
  const provisionRemoveModified = baselineEntry === void 0 || !valuesEqual(provisionRemove, baselineEntry.provision?.remove ?? "");
  const prepareHookModified = baselineEntry === void 0 || !valuesEqual(
    prepareHook.length === 0 ? void 0 : prepareHook,
    baselineEntry.prepareWorktreeHook
  );
  function buildEntry() {
    const hasProvision = provisionCreate.trim().length > 0 || provisionRemove.trim().length > 0;
    return {
      name,
      projectDirOverride: override.length === 0 ? void 0 : override,
      workdir: workdir.length === 0 ? void 0 : workdir,
      provision: hasProvision ? { create: provisionCreate, remove: provisionRemove } : void 0,
      prepareWorktreeHook: prepareHook.length === 0 ? void 0 : prepareHook
    };
  }
  useInput11(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) setActive((a) => Math.min(FIELD_COUNT - 1, a + 1));
      if (key.upArrow) setActive((a) => Math.max(0, a - 1));
      if (key.return) onSave(buildEntry());
    },
    { isActive: !guard.guarding }
  );
  if (guard.guarding) {
    return /* @__PURE__ */ jsx13(
      SaveGuard,
      {
        onApply: () => onSave(buildEntry()),
        onDiscard: onCancel,
        onCancel: guard.keepEditing
      }
    );
  }
  const overrideFilled = override.trim().length > 0;
  const provisionFilled = provisionCreate.trim().length > 0 || provisionRemove.trim().length > 0;
  const overrideDisabled = provisionFilled && !overrideFilled;
  const provisionDisabled = overrideFilled && !provisionFilled;
  const base = override.length === 0 ? projectDir : override;
  return /* @__PURE__ */ jsxs13(Box13, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx13(Text13, { bold: true, children: "Repository" }),
    /* @__PURE__ */ jsxs13(Box13, { flexDirection: "column", marginTop: 1, children: [
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "name",
          value: name,
          isActive: active === 0,
          modified: nameModified,
          onChange: guard.track(setName)
        }
      ),
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "projectDirOverride",
          value: override,
          placeholder: `${projectDir}  (default)`,
          isActive: active === 1,
          modified: overrideModified,
          onChange: guard.track(setOverride),
          disabled: overrideDisabled,
          disabledHint: "(disabled \u2014 clear provision to use)"
        }
      ),
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "workdir",
          value: workdir,
          placeholder: "subdir within the worktree to start working from (optional)",
          isActive: active === 2,
          modified: workdirModified,
          onChange: guard.track(setWorkdir)
        }
      ),
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "provision.create",
          value: provisionCreate,
          placeholder: "replaces `git worktree add`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}",
          isActive: active === 3,
          modified: provisionCreateModified,
          onChange: guard.track(setProvisionCreate),
          disabled: provisionDisabled,
          disabledHint: "(disabled \u2014 clear projectDirOverride to use)"
        }
      ),
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "provision.remove",
          value: provisionRemove,
          placeholder: "replaces `git worktree remove`; vars: ${repo} ${branch} ${dir} ${baseRef} ${task}",
          isActive: active === 4,
          modified: provisionRemoveModified,
          onChange: guard.track(setProvisionRemove),
          disabled: provisionDisabled,
          disabledHint: "(disabled \u2014 clear projectDirOverride to use)"
        }
      ),
      /* @__PURE__ */ jsx13(
        TextField,
        {
          label: "hooks.prepareWorktree",
          value: prepareHook,
          placeholder: "shell run inside a fresh worktree (optional)",
          isActive: active === 5,
          modified: prepareHookModified,
          onChange: guard.track(setPrepareHook)
        }
      )
    ] }),
    /* @__PURE__ */ jsx13(Box13, { marginTop: 1, children: /* @__PURE__ */ jsxs13(Text13, { dimColor: true, children: [
      "Repo located at: ",
      base,
      "/",
      name
    ] }) }),
    /* @__PURE__ */ jsx13(Box13, { children: /* @__PURE__ */ jsx13(Text13, { dimColor: true, children: `Settings for one repository. "name" is its folder name; everything else is an optional override. provision is scripted worktree setup \u2014 it needs both templates and can't combine with projectDirOverride.` }) }),
    /* @__PURE__ */ jsx13(Box13, { marginTop: 1, children: /* @__PURE__ */ jsx13(Text13, { dimColor: true, children: "hooks.prepareWorktree cascade: a repo-committed .groundcrew/config.json wins, then this per-repo setting, then defaults.hooks.prepareWorktree." }) })
  ] });
}

// src/screens/DeleteGuard.tsx
import { Box as Box14, Text as Text14, useInput as useInput12 } from "ink";
import { jsx as jsx14, jsxs as jsxs14 } from "react/jsx-runtime";
function DeleteGuard({ name, onConfirm, onCancel }) {
  useInput12((input, key) => {
    if (input === "y" || key.return) onConfirm();
    if (key.escape) onCancel();
  });
  return /* @__PURE__ */ jsxs14(Box14, { flexDirection: "column", borderStyle: "double", paddingX: 2, paddingY: 1, children: [
    /* @__PURE__ */ jsxs14(Text14, { bold: true, children: [
      "Delete ",
      name,
      "?"
    ] }),
    /* @__PURE__ */ jsx14(Box14, { marginTop: 1, children: /* @__PURE__ */ jsx14(Text14, { dimColor: true, children: "[y] Delete [esc] Cancel" }) })
  ] });
}

// src/screens/RepositoriesForm.tsx
import { jsx as jsx15, jsxs as jsxs15 } from "react/jsx-runtime";
function RepositoriesForm({
  draft,
  baseline,
  onChange,
  onBack
}) {
  const [editing, setEditing] = useState11(void 0);
  const [pendingDelete, setPendingDelete] = useState11(
    void 0
  );
  const entries = normalizeRepos(draft.workspace.knownRepositories);
  const baseEntries = normalizeRepos(baseline.workspace.knownRepositories);
  const modified = modifiedByKey(entries, baseEntries, (entry) => entry.name);
  const errors = repoErrors(entries);
  const listActive = editing === void 0 && pendingDelete === void 0;
  useInput13(
    (_input, key) => {
      if (!listActive) return;
      if (key.escape) onBack();
    },
    { isActive: listActive }
  );
  function commitEntries(next) {
    onChange(
      setByPath(
        draft,
        "workspace.knownRepositories",
        denormalizeRepos(next)
      )
    );
  }
  function duplicateAt(index) {
    const source = entries[index];
    if (source === void 0) return;
    const copy = duplicateEntry(
      source,
      entries.map((entry) => entry.name)
    );
    const next = [...entries];
    next.splice(index + 1, 0, copy);
    commitEntries(next);
    setEditing(index + 1);
  }
  if (editing !== void 0) {
    const current = entries[editing] ?? {
      name: "",
      projectDirOverride: void 0
    };
    const baselineEntry = baseEntries.find((e) => e.name === current.name);
    return /* @__PURE__ */ jsx15(
      RepoSubForm,
      {
        entry: current,
        baselineEntry,
        projectDir: draft.workspace.projectDir,
        onSave: (entry) => {
          const next = [...entries];
          next[editing] = entry;
          commitEntries(next);
          setEditing(void 0);
        },
        onCancel: () => setEditing(void 0)
      }
    );
  }
  const items = entries.map((entry, index) => ({
    label: entry.name,
    note: entry.projectDirOverride ? `\u2192 at ${entry.projectDirOverride}` : void 0,
    error: errors[index],
    modified: modified[index]
  }));
  if (pendingDelete !== void 0) {
    const target2 = entries[pendingDelete];
    return /* @__PURE__ */ jsx15(
      DeleteGuard,
      {
        name: target2?.name ?? "this repo",
        onConfirm: () => {
          commitEntries(entries.filter((_, i) => i !== pendingDelete));
          setPendingDelete(void 0);
        },
        onCancel: () => setPendingDelete(void 0)
      }
    );
  }
  return /* @__PURE__ */ jsxs15(Box15, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx15(Text15, { bold: true, children: "Repositories" }),
    /* @__PURE__ */ jsx15(Box15, { marginTop: 1, flexDirection: "column", children: /* @__PURE__ */ jsx15(
      ListField,
      {
        items,
        isActive: pendingDelete === void 0,
        onActivate: (index) => setEditing(index === entries.length ? entries.length : index),
        onDelete: (index) => setPendingDelete(index),
        itemActions: [{ key: "c", onPress: duplicateAt }]
      }
    ) }),
    /* @__PURE__ */ jsx15(Box15, { marginTop: 1, children: /* @__PURE__ */ jsx15(Text15, { dimColor: true, children: "The repos groundcrew is allowed to work on, listed by their local folder name (each must already exist under your projectDir). \u2191/\u2193 move \xB7 enter edit \xB7 c duplicate \xB7 d delete (confirm) \xB7 esc back." }) })
  ] });
}

// src/screens/SectionForm.tsx
import { useState as useState12 } from "react";
import { Box as Box17, Text as Text17, useInput as useInput15 } from "ink";

// src/components/SelectField.tsx
import { Box as Box16, Text as Text16, useInput as useInput14 } from "ink";
import { jsx as jsx16, jsxs as jsxs16 } from "react/jsx-runtime";
function SelectField({
  label,
  value,
  options,
  isActive,
  onChange,
  modified = false
}) {
  useInput14(
    (_input, key) => {
      if (options.length === 0) return;
      const index = Math.max(0, options.indexOf(value));
      if (key.rightArrow)
        onChange(options[(index + 1) % options.length] ?? value);
      if (key.leftArrow)
        onChange(
          options[(index - 1 + options.length) % options.length] ?? value
        );
    },
    { isActive }
  );
  return /* @__PURE__ */ jsxs16(Box16, { children: [
    /* @__PURE__ */ jsxs16(Text16, { color: isActive ? "cyan" : void 0, children: [
      isActive ? "\u203A " : "  ",
      label,
      " "
    ] }),
    /* @__PURE__ */ jsx16(Text16, { children: options.map((opt) => opt === value ? `[${opt}]` : ` ${opt} `).join(" ") }),
    modified ? /* @__PURE__ */ jsx16(Text16, { color: "yellow", children: " \u25CF" }) : null
  ] });
}

// src/screens/SectionForm.tsx
import { jsx as jsx17, jsxs as jsxs17 } from "react/jsx-runtime";
function asString4(value) {
  return value === void 0 ? "" : String(value);
}
function SectionForm({
  title,
  description,
  spec,
  draft,
  baseline,
  onChange,
  onBack
}) {
  const [active, setActive] = useState12(0);
  useInput15((_input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setActive((a) => Math.min(spec.length - 1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
  });
  function update(field, raw) {
    let value;
    if (raw.length === 0) {
      value = void 0;
    } else if (field.kind === "number") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      value = parsed;
    } else {
      value = raw;
    }
    onChange(
      setByPath(
        draft,
        field.path,
        value
      )
    );
  }
  const focused = spec[active];
  return /* @__PURE__ */ jsxs17(Box17, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx17(Text17, { bold: true, children: title }),
    /* @__PURE__ */ jsx17(Box17, { flexDirection: "column", marginTop: 1, children: spec.map((field, index) => {
      const modified = !valuesEqual(
        getByPath(baseline, field.path),
        getByPath(draft, field.path)
      );
      return field.kind === "select" ? /* @__PURE__ */ jsx17(
        SelectField,
        {
          label: field.label,
          options: field.options ?? [],
          value: asString4(
            getByPath(draft, field.path) ?? field.options?.[0]
          ),
          isActive: index === active,
          modified,
          onChange: (v) => update(field, v)
        },
        field.path
      ) : /* @__PURE__ */ jsx17(
        TextField,
        {
          label: field.label,
          value: asString4(getByPath(draft, field.path)),
          placeholder: field.placeholder,
          isActive: index === active,
          modified,
          onChange: (v) => update(field, v)
        },
        field.path
      );
    }) }),
    /* @__PURE__ */ jsxs17(Box17, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx17(Text17, { dimColor: true, children: description }),
      focused ? /* @__PURE__ */ jsx17(Text17, { dimColor: true, children: focused.help }) : null
    ] })
  ] });
}

// src/screens/TaskSourcesMenu.tsx
import { useRef as useRef9, useState as useState19 } from "react";
import { Box as Box25, Text as Text25, useInput as useInput23 } from "ink";

// src/screens/LinearForm.tsx
import { useState as useState13 } from "react";
import { Box as Box18, Text as Text18, useInput as useInput16 } from "ink";

// src/domain/env.ts
var LINEAR_KEY_SOURCES = [
  "GROUNDCREW_LINEAR_API_KEY",
  "LINEAR_API_KEY"
];
function linearApiKeyStatus(env) {
  for (const source of LINEAR_KEY_SOURCES) {
    const value = env[source];
    if (value !== void 0 && value.trim().length > 0) {
      return { set: true, source };
    }
  }
  return { set: false };
}

// src/screens/LinearForm.tsx
import { jsx as jsx18, jsxs as jsxs18 } from "react/jsx-runtime";
var FIELD_ROWS = [
  { key: "team", label: "team" },
  { key: "name", label: "name" },
  { key: "inProgress", label: "statuses.inProgress" },
  { key: "inReview", label: "statuses.inReview" }
];
function LinearForm({
  draft,
  baseline,
  onChange,
  onBack,
  env = process.env
}) {
  const enabled = isLinearEnabled(draft);
  const key = linearApiKeyStatus(env);
  const [focus, setFocus] = useState13(0);
  const maxRow = enabled ? FIELD_ROWS.length : 0;
  const row = Math.min(focus, maxRow);
  useInput16((input, k) => {
    if (k.escape) {
      onBack();
      return;
    }
    if (k.downArrow) setFocus((f) => Math.min(maxRow, f + 1));
    if (k.upArrow) setFocus((f) => Math.max(0, f - 1));
    if (input === " " && row === 0) onChange(setLinearEnabled(draft, !enabled));
  });
  const enableModified = isLinearEnabled(draft) !== isLinearEnabled(baseline);
  return /* @__PURE__ */ jsxs18(Box18, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx18(Text18, { bold: true, children: "Linear (built-in)" }),
    /* @__PURE__ */ jsx18(Box18, { marginTop: 1, children: /* @__PURE__ */ jsxs18(Text18, { color: row === 0 ? "cyan" : void 0, children: [
      row === 0 ? "\u25B8 " : "  ",
      "Built-in Linear source:",
      " ",
      /* @__PURE__ */ jsx18(Text18, { color: enabled ? "green" : "yellow", children: enabled ? "enabled" : "disabled" }),
      enableModified ? /* @__PURE__ */ jsx18(Text18, { color: "yellow", children: " \u25CF" }) : null
    ] }) }),
    enabled ? /* @__PURE__ */ jsx18(Box18, { flexDirection: "column", marginTop: 1, children: FIELD_ROWS.map((field, index) => {
      const isStatus = field.key === "inProgress" || field.key === "inReview";
      const value = isStatus ? getLinearStatuses(draft, field.key) : getLinearField(draft, field.key) ?? "";
      const baselineValue = isStatus ? getLinearStatuses(baseline, field.key) : getLinearField(baseline, field.key) ?? "";
      const modified = !valuesEqual(value, baselineValue);
      return /* @__PURE__ */ jsx18(
        TextField,
        {
          label: field.label,
          value,
          placeholder: isStatus ? "comma-separated names  (optional)" : "(optional)",
          isActive: row === index + 1,
          modified,
          onChange: (v) => onChange(
            isStatus ? setLinearStatuses(draft, field.key, v) : setLinearField(draft, field.key, v)
          )
        },
        field.key
      );
    }) }) : null,
    /* @__PURE__ */ jsx18(Box18, { marginTop: 1, children: /* @__PURE__ */ jsxs18(Text18, { children: [
      "API key:",
      " ",
      key.set ? /* @__PURE__ */ jsxs18(Text18, { color: "green", children: [
        "detected (",
        key.source,
        ")"
      ] }) : /* @__PURE__ */ jsx18(Text18, { color: "yellow", children: "not set" })
    ] }) }),
    /* @__PURE__ */ jsxs18(Box18, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx18(Text18, { dimColor: true, children: "Pull tasks from Linear. Space toggles the source (top row). team/name and the inProgress/inReview status names are optional overrides. Your API key is read from the environment, not stored here." }),
      key.set ? null : /* @__PURE__ */ jsx18(Text18, { dimColor: true, children: 'Set it: export GROUNDCREW_LINEAR_API_KEY="lin_api_..."' })
    ] })
  ] });
}

// src/screens/PlanKeeperForm.tsx
import { Box as Box19, Text as Text19, useInput as useInput17 } from "ink";
import { jsx as jsx19, jsxs as jsxs19 } from "react/jsx-runtime";
function PlanKeeperForm({ draft, baseline, onChange, onBack }) {
  const enabled = isPlanKeeperEnabled(draft);
  const enableModified = isPlanKeeperEnabled(draft) !== isPlanKeeperEnabled(baseline);
  const commands = planKeeperCommands(draft);
  const sandboxPaths = planKeeperSandboxPaths(draft);
  const labelWidth = (commands ?? []).reduce(
    (max, [name]) => Math.max(max, name.length),
    0
  );
  useInput17((input, key) => {
    if (key.escape) onBack();
    if (input === " ") onChange(setPlanKeeperEnabled(draft, !enabled));
  });
  return /* @__PURE__ */ jsxs19(Box19, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx19(Text19, { bold: true, children: "PlanKeeper" }),
    /* @__PURE__ */ jsx19(Box19, { marginTop: 1, children: /* @__PURE__ */ jsxs19(Text19, { children: [
      "plan-keeper source:",
      " ",
      /* @__PURE__ */ jsx19(Text19, { color: enabled ? "green" : "yellow", children: enabled ? "enabled" : "disabled" }),
      enableModified ? /* @__PURE__ */ jsx19(Text19, { color: "yellow", children: " \u25CF" }) : null
    ] }) }),
    /* @__PURE__ */ jsxs19(Box19, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx19(Text19, { dimColor: true, children: "Feeds saved plans from ~/plans in as tasks (via the plan-keeper tool). Space toggles." }),
      /* @__PURE__ */ jsx19(Text19, { dimColor: true, children: "Install: brew install paulbaranowski/tap/plan-keeper" })
    ] }),
    commands && commands.length > 0 ? /* @__PURE__ */ jsxs19(Box19, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx19(Text19, { children: "Commands:" }),
      commands.map(([name, command]) => /* @__PURE__ */ jsxs19(Text19, { dimColor: true, children: [
        "  ",
        name.padEnd(labelWidth),
        " ",
        command
      ] }, name))
    ] }) : null,
    sandboxPaths && sandboxPaths.length > 0 ? /* @__PURE__ */ jsxs19(Box19, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx19(Text19, { children: "Sandbox write paths:" }),
      sandboxPaths.map((p, i) => /* @__PURE__ */ jsxs19(Text19, { dimColor: true, children: [
        "  ",
        p
      ] }, `${i}:${p}`))
    ] }) : null
  ] });
}

// src/screens/ShellSourcesForm.tsx
import { useState as useState17 } from "react";
import { Box as Box23, Text as Text23, useInput as useInput21 } from "ink";

// src/screens/ShellSourceSubForm.tsx
import { useRef as useRef8, useState as useState16 } from "react";
import { Box as Box22, Text as Text22, useInput as useInput20 } from "ink";

// src/screens/ShellEnvEditor.tsx
import { useState as useState14 } from "react";
import { Box as Box20, Text as Text20, useInput as useInput18 } from "ink";
import { jsx as jsx20, jsxs as jsxs20 } from "react/jsx-runtime";
function EnvEntryEditor({
  entry,
  onSave,
  onCancel
}) {
  const [key, setKey] = useState14(entry.key);
  const [value, setValue] = useState14(entry.value);
  const [active, setActive] = useState14(0);
  const guard = useEditGuard();
  useInput18(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (k.downArrow) setActive((a) => Math.min(1, a + 1));
      if (k.upArrow) setActive((a) => Math.max(0, a - 1));
      if (k.return) onSave({ key, value });
    },
    { isActive: !guard.guarding }
  );
  if (guard.guarding) {
    return /* @__PURE__ */ jsx20(
      SaveGuard,
      {
        onApply: () => onSave({ key, value }),
        onDiscard: onCancel,
        onCancel: guard.keepEditing
      }
    );
  }
  return /* @__PURE__ */ jsxs20(Box20, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx20(Text20, { bold: true, children: "Environment variable" }),
    /* @__PURE__ */ jsxs20(Box20, { flexDirection: "column", marginTop: 1, children: [
      /* @__PURE__ */ jsx20(
        TextField,
        {
          label: "key",
          value: key,
          placeholder: "VAR_NAME",
          isActive: active === 0,
          onChange: guard.track(setKey)
        }
      ),
      /* @__PURE__ */ jsx20(
        TextField,
        {
          label: "value",
          value,
          placeholder: "stored literally in the config",
          isActive: active === 1,
          onChange: guard.track(setValue)
        }
      )
    ] }),
    key.trim().length === 0 ? /* @__PURE__ */ jsx20(Box20, { marginTop: 1, children: /* @__PURE__ */ jsx20(Text20, { color: "yellow", children: "\u26A0 key is required (a blank key is dropped)." }) }) : null,
    /* @__PURE__ */ jsx20(Box20, { marginTop: 1, children: /* @__PURE__ */ jsx20(Text20, { dimColor: true, children: "\u2191/\u2193 move \xB7 type to edit \xB7 enter apply \xB7 esc cancel." }) })
  ] });
}
function ShellEnvEditor({ env, baselineEnv, onChange, onBack }) {
  const [editing, setEditing] = useState14(void 0);
  const modified = modifiedByKey(env, baselineEnv, (e, i) => e.key || `__blank__${i}`);
  useInput18(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === void 0 }
  );
  if (editing !== void 0) {
    const entry = editing === "new" ? { key: "", value: "" } : env[editing] ?? { key: "", value: "" };
    return /* @__PURE__ */ jsx20(
      EnvEntryEditor,
      {
        entry,
        onSave: (next) => {
          onChange(
            editing === "new" ? [...env, next] : env.map((e, i) => i === editing ? next : e)
          );
          setEditing(void 0);
        },
        onCancel: () => setEditing(void 0)
      },
      String(editing)
    );
  }
  const items = env.map((entry, index) => ({
    label: entry.key || "(unnamed)",
    note: `= ${entry.value || "(empty)"}`,
    error: void 0,
    modified: modified[index]
  }));
  return /* @__PURE__ */ jsxs20(Box20, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx20(Text20, { bold: true, children: "Environment variables" }),
    /* @__PURE__ */ jsx20(Box20, { marginTop: 1, flexDirection: "column", children: /* @__PURE__ */ jsx20(
      ListField,
      {
        items,
        isActive: true,
        addLabel: "+ add variable\u2026",
        onActivate: (index) => setEditing(index >= env.length ? "new" : index),
        onDelete: (index) => onChange(env.filter((_, i) => i !== index))
      }
    ) }),
    /* @__PURE__ */ jsx20(Box20, { marginTop: 1, children: /* @__PURE__ */ jsx20(Text20, { dimColor: true, children: "Extra environment variables passed to every command for this source (e.g. API tokens, hostnames). Stored literally in the config. \u2191/\u2193 move \xB7 enter edit \xB7 d delete \xB7 esc back." }) })
  ] });
}

// src/screens/ShellSandboxPathsEditor.tsx
import { useState as useState15 } from "react";
import { Box as Box21, Text as Text21, useInput as useInput19 } from "ink";
import { jsx as jsx21, jsxs as jsxs21 } from "react/jsx-runtime";
function PathEntryEditor({
  value,
  onSave,
  onCancel
}) {
  const [path11, setPath] = useState15(value);
  const guard = useEditGuard();
  useInput19(
    (_input, k) => {
      if (k.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (k.return && path11.trim().length > 0) onSave(path11);
    },
    { isActive: !guard.guarding }
  );
  if (guard.guarding) {
    const apply = path11.trim().length === 0 ? onCancel : () => onSave(path11);
    return /* @__PURE__ */ jsx21(
      SaveGuard,
      {
        onApply: apply,
        onDiscard: onCancel,
        onCancel: guard.keepEditing
      }
    );
  }
  return /* @__PURE__ */ jsxs21(Box21, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx21(Text21, { bold: true, children: "Sandbox write path" }),
    /* @__PURE__ */ jsx21(Box21, { flexDirection: "column", marginTop: 1, children: /* @__PURE__ */ jsx21(
      TextField,
      {
        label: "path",
        value: path11,
        placeholder: "absolute or ~ path the command may write to",
        isActive: true,
        onChange: guard.track(setPath)
      }
    ) }),
    path11.trim().length === 0 ? /* @__PURE__ */ jsx21(Box21, { marginTop: 1, children: /* @__PURE__ */ jsx21(Text21, { color: "yellow", children: "\u26A0 path is required (a blank row is dropped)." }) }) : null,
    /* @__PURE__ */ jsx21(Box21, { marginTop: 1, children: /* @__PURE__ */ jsx21(Text21, { dimColor: true, children: "type to edit \xB7 enter apply \xB7 esc cancel." }) })
  ] });
}
function ShellSandboxPathsEditor({
  paths,
  baselinePaths,
  onChange,
  onBack
}) {
  const [editing, setEditing] = useState15(void 0);
  const modified = modifiedByKey(
    paths,
    baselinePaths,
    (p, i) => p || `__blank__${i}`
  );
  useInput19(
    (_input, key) => {
      if (key.escape) onBack();
    },
    { isActive: editing === void 0 }
  );
  if (editing !== void 0) {
    const value = editing === "new" ? "" : paths[editing] ?? "";
    return /* @__PURE__ */ jsx21(
      PathEntryEditor,
      {
        value,
        onSave: (next) => {
          onChange(
            editing === "new" ? [...paths, next] : paths.map((p, i) => i === editing ? next : p)
          );
          setEditing(void 0);
        },
        onCancel: () => setEditing(void 0)
      },
      String(editing)
    );
  }
  const items = paths.map((path11, index) => ({
    label: path11 || "(unnamed)",
    note: void 0,
    error: void 0,
    modified: modified[index]
  }));
  return /* @__PURE__ */ jsxs21(Box21, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx21(Text21, { bold: true, children: "Sandbox write paths" }),
    /* @__PURE__ */ jsx21(Box21, { marginTop: 1, flexDirection: "column", children: /* @__PURE__ */ jsx21(
      ListField,
      {
        items,
        isActive: true,
        addLabel: "+ add path\u2026",
        onActivate: (index) => setEditing(index >= paths.length ? "new" : index),
        onDelete: (index) => onChange(paths.filter((_, i) => i !== index))
      }
    ) }),
    /* @__PURE__ */ jsx21(Box21, { marginTop: 1, children: /* @__PURE__ */ jsx21(Text21, { dimColor: true, children: "Extra filesystem paths this source's commands may write to under groundcrew's sandbox. Stored literally; ~ is expanded by groundcrew. \u2191/\u2193 move \xB7 enter edit \xB7 d delete \xB7 esc back." }) })
  ] });
}

// src/screens/ShellSourceSubForm.tsx
import { jsx as jsx22, jsxs as jsxs22 } from "react/jsx-runtime";
var ROWS2 = [
  { key: "name", label: "name", placeholder: "kebab-case, e.g. jira" },
  { key: "verify", label: "commands.verify", placeholder: "connectivity check (optional)" },
  { key: "validate", label: "commands.validate", placeholder: "emit JSON array of config error strings (optional)" },
  { key: "listTasks", label: "commands.listTasks", placeholder: "emit ShellIssue[] JSON (required)" },
  { key: "getTask", label: "commands.getTask", placeholder: "emit one ShellIssue for ${id}" },
  { key: "createTask", label: "commands.createTask", placeholder: "create from ${title}/${description}, emit the new ShellIssue (optional)" },
  { key: "markInProgress", label: "commands.markInProgress", placeholder: "move ${id} in-progress" },
  { key: "markInReview", label: "commands.markInReview", placeholder: "move ${id} in-review" },
  { key: "markDone", label: "commands.markDone", placeholder: "move ${id} done" },
  { key: "cwd", label: "cwd", placeholder: "working dir for commands (optional)" }
];
var ENV_ROW = ROWS2.length;
var SANDBOX_ROW = ENV_ROW + 1;
function ShellSourceSubForm({
  source,
  baselineSource,
  onSave,
  onCancel
}) {
  const [fields, setFields] = useState16(() => readShellFields(source));
  const baselineFields = readShellFields(baselineSource);
  const [active, setActive] = useState16(0);
  const [mode, setMode] = useState16("fields");
  const guard = useEditGuard();
  const activeRef = useRef8(0);
  function moveActive(next) {
    activeRef.current = next;
    setActive(next);
  }
  useInput20(
    (_input, key) => {
      if (key.escape) {
        guard.requestCancel(onCancel);
        return;
      }
      if (key.downArrow) moveActive(Math.min(SANDBOX_ROW, activeRef.current + 1));
      if (key.upArrow) moveActive(Math.max(0, activeRef.current - 1));
      if (key.return) {
        if (activeRef.current === ENV_ROW) setMode("env");
        else if (activeRef.current === SANDBOX_ROW) setMode("paths");
        else onSave(applyShellFields(source, fields));
      }
    },
    { isActive: mode === "fields" && !guard.guarding }
  );
  if (guard.guarding) {
    return /* @__PURE__ */ jsx22(
      SaveGuard,
      {
        onApply: () => onSave(applyShellFields(source, fields)),
        onDiscard: onCancel,
        onCancel: guard.keepEditing
      }
    );
  }
  if (mode === "env") {
    return /* @__PURE__ */ jsx22(
      ShellEnvEditor,
      {
        env: fields.env,
        baselineEnv: baselineFields.env,
        onChange: (env) => {
          guard.markDirty();
          setFields((f) => ({ ...f, env }));
        },
        onBack: () => setMode("fields")
      }
    );
  }
  if (mode === "paths") {
    return /* @__PURE__ */ jsx22(
      ShellSandboxPathsEditor,
      {
        paths: fields.sandboxWritePaths,
        baselinePaths: baselineFields.sandboxWritePaths,
        onChange: (sandboxWritePaths) => {
          guard.markDirty();
          setFields((f) => ({ ...f, sandboxWritePaths }));
        },
        onBack: () => setMode("fields")
      }
    );
  }
  const nameMissing = fields.name.trim().length === 0;
  const listTasksMissing = fields.listTasks.trim().length === 0;
  const envActive = active === ENV_ROW;
  const envCount = fields.env.length;
  const pathsActive = active === SANDBOX_ROW;
  const pathsCount = fields.sandboxWritePaths.length;
  const envModified = baselineSource === void 0 || !valuesEqual(fields.env, baselineFields.env);
  const pathsModified = baselineSource === void 0 || !valuesEqual(fields.sandboxWritePaths, baselineFields.sandboxWritePaths);
  return /* @__PURE__ */ jsxs22(Box22, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx22(Text22, { bold: true, children: "Shell source" }),
    /* @__PURE__ */ jsxs22(Box22, { flexDirection: "column", marginTop: 1, children: [
      ROWS2.map((row, index) => {
        const modified = baselineSource === void 0 || !valuesEqual(fields[row.key], baselineFields[row.key]);
        return /* @__PURE__ */ jsx22(
          TextField,
          {
            label: row.label,
            value: fields[row.key],
            placeholder: row.placeholder,
            isActive: active === index,
            modified,
            onChange: (v) => {
              guard.markDirty();
              setFields((f) => ({ ...f, [row.key]: v }));
            }
          },
          row.key
        );
      }),
      /* @__PURE__ */ jsxs22(Box22, { children: [
        /* @__PURE__ */ jsxs22(Text22, { color: envActive ? "cyan" : void 0, children: [
          envActive ? "\u203A " : "  ",
          "env",
          " "
        ] }),
        /* @__PURE__ */ jsxs22(Text22, { dimColor: true, children: [
          envCount,
          " variable",
          envCount === 1 ? "" : "s",
          " \u2014 enter to edit"
        ] }),
        envModified ? /* @__PURE__ */ jsx22(Text22, { color: "yellow", children: " \u25CF" }) : null
      ] }),
      /* @__PURE__ */ jsxs22(Box22, { children: [
        /* @__PURE__ */ jsxs22(Text22, { color: pathsActive ? "cyan" : void 0, children: [
          pathsActive ? "\u203A " : "  ",
          "sandboxWritePaths",
          " "
        ] }),
        /* @__PURE__ */ jsxs22(Text22, { dimColor: true, children: [
          pathsCount,
          " path",
          pathsCount === 1 ? "" : "s",
          " \u2014 enter to edit"
        ] }),
        pathsModified ? /* @__PURE__ */ jsx22(Text22, { color: "yellow", children: " \u25CF" }) : null
      ] })
    ] }),
    nameMissing || listTasksMissing ? /* @__PURE__ */ jsxs22(Box22, { marginTop: 1, flexDirection: "column", children: [
      nameMissing ? /* @__PURE__ */ jsx22(Text22, { color: "yellow", children: "\u26A0 name is required (kebab-case)." }) : null,
      listTasksMissing ? /* @__PURE__ */ jsx22(Text22, { color: "yellow", children: "\u26A0 commands.listTasks is required (or the legacy fetch alias)." }) : null
    ] }) : null,
    /* @__PURE__ */ jsx22(Box22, { marginTop: 1, children: /* @__PURE__ */ jsxs22(Text22, { dimColor: true, children: [
      "Commands groundcrew runs to talk to your tracker. listTasks is required;",
      " ",
      "${id}",
      " is filled in per task. \u2191/\u2193 move \xB7 type to edit \xB7 enter apply \xB7 esc cancel."
    ] }) })
  ] });
}

// src/screens/ShellSourcesForm.tsx
import { jsx as jsx23, jsxs as jsxs23 } from "react/jsx-runtime";
function ShellSourcesForm({
  draft,
  baseline,
  onChange,
  onBack
}) {
  const [editing, setEditing] = useState17(void 0);
  const entries = shellSources(draft);
  const baseEntries = shellSources(baseline);
  const modified = modifiedByKey(
    entries,
    baseEntries,
    (s, i) => s.name || `__blank__${i}`
  );
  useInput21(
    (_input, key) => {
      if (editing !== void 0) return;
      if (key.escape) onBack();
    },
    { isActive: editing === void 0 }
  );
  function commit(next) {
    onChange(setShellSources(draft, next));
  }
  if (editing !== void 0) {
    const current = entries[editing];
    const baselineSource = baseEntries.find((e) => e.name === current?.name);
    return /* @__PURE__ */ jsx23(
      ShellSourceSubForm,
      {
        source: current,
        baselineSource,
        onSave: (source) => {
          const next = [...entries];
          next[editing] = source;
          commit(next);
          setEditing(void 0);
        },
        onCancel: () => setEditing(void 0)
      }
    );
  }
  const items = entries.map((entry, index) => {
    const listTasks = shellListTasksCommand(entry);
    return {
      label: entry.name || "(unnamed)",
      note: listTasks ? `\u2192 ${listTasks}` : "\u26A0 no listTasks",
      error: void 0,
      modified: modified[index]
    };
  });
  return /* @__PURE__ */ jsxs23(Box23, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx23(Text23, { bold: true, children: "Shell sources" }),
    /* @__PURE__ */ jsx23(Box23, { marginTop: 1, flexDirection: "column", children: /* @__PURE__ */ jsx23(
      ListField,
      {
        items,
        isActive: true,
        addLabel: "+ add shell source\u2026",
        onActivate: (index) => setEditing(index),
        onDelete: (index) => commit(entries.filter((_, i) => i !== index))
      }
    ) }),
    /* @__PURE__ */ jsx23(Box23, { marginTop: 1, children: /* @__PURE__ */ jsx23(Text23, { dimColor: true, children: "Connect any other tracker (Jira, GitHub Issues, \u2026) by giving groundcrew shell commands that list and update its tasks. \u2191/\u2193 move \xB7 enter edit \xB7 d delete \xB7 esc back." }) })
  ] });
}

// src/screens/TodoTxtForm.tsx
import { useState as useState18 } from "react";
import { Box as Box24, Text as Text24, useInput as useInput22 } from "ink";
import { jsx as jsx24, jsxs as jsxs24 } from "react/jsx-runtime";
var FIELDS = [
  { field: "todoPath", placeholder: "~/todo.txt  (default)" },
  { field: "tasksDir", placeholder: "~/tasks  (default)" },
  { field: "defaultRepository", placeholder: "owner/repo  (optional)" },
  { field: "idPrefix", placeholder: "GC  (default)" },
  { field: "timezone", placeholder: "UTC  (default)" }
];
function TodoTxtForm({ draft, baseline, onChange, onBack }) {
  const enabled = isTodoTxtEnabled(draft);
  const [focusIndex, setFocusIndex] = useState18(0);
  const focus = FIELDS[focusIndex]?.field ?? "todoPath";
  useInput22((input, key) => {
    if (key.escape) onBack();
    if (input === " ") onChange(setTodoTxtEnabled(draft, !enabled));
    if (!enabled) return;
    if (key.downArrow) setFocusIndex((f) => Math.min(FIELDS.length - 1, f + 1));
    if (key.upArrow) setFocusIndex((f) => Math.max(0, f - 1));
  });
  const enableModified = isTodoTxtEnabled(draft) !== isTodoTxtEnabled(baseline);
  return /* @__PURE__ */ jsxs24(Box24, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx24(Text24, { bold: true, children: "todo-txt" }),
    /* @__PURE__ */ jsx24(Box24, { marginTop: 1, children: /* @__PURE__ */ jsxs24(Text24, { children: [
      "todo-txt source:",
      " ",
      /* @__PURE__ */ jsx24(Text24, { color: enabled ? "green" : "yellow", children: enabled ? "enabled" : "disabled" }),
      enableModified ? /* @__PURE__ */ jsx24(Text24, { color: "yellow", children: " \u25CF" }) : null
    ] }) }),
    enabled ? /* @__PURE__ */ jsx24(Box24, { flexDirection: "column", marginTop: 1, children: FIELDS.map(({ field, placeholder }) => {
      const value = getTodoTxtField(draft, field) ?? "";
      const baseValue = getTodoTxtField(baseline, field) ?? "";
      const modified = !valuesEqual(value, baseValue);
      return /* @__PURE__ */ jsx24(
        TextField,
        {
          label: field,
          value,
          placeholder,
          isActive: focus === field,
          modified,
          onChange: (v) => onChange(setTodoTxtField(draft, field, v))
        },
        field
      );
    }) }) : null,
    /* @__PURE__ */ jsx24(Box24, { marginTop: 1, flexDirection: "column", children: /* @__PURE__ */ jsx24(Text24, { dimColor: true, children: "Use a plain todo.txt file on your computer as the task list \u2014 no accounts or API keys needed. Space toggles. \u2191/\u2193 moves between fields." }) })
  ] });
}

// src/screens/TaskSourcesMenu.tsx
import { jsx as jsx25, jsxs as jsxs25 } from "react/jsx-runtime";
var ROWS3 = [
  "linear",
  "todoTxt",
  "planKeeper",
  "shell"
];
function TaskSourcesMenu({ draft, baseline, onChange, onBack }) {
  const [sub, setSub] = useState19("hub");
  const [cursor, setCursor] = useState19(0);
  const cursorRef = useRef9(0);
  function moveCursor(next) {
    cursorRef.current = next;
    setCursor(next);
  }
  useInput23(
    (_input, key) => {
      if (sub !== "hub") return;
      if (key.escape) onBack();
      if (key.downArrow)
        moveCursor(Math.min(ROWS3.length - 1, cursorRef.current + 1));
      if (key.upArrow) moveCursor(Math.max(0, cursorRef.current - 1));
      if (key.return) {
        const next = ROWS3[cursorRef.current];
        if (next) setSub(next);
      }
    },
    { isActive: sub === "hub" }
  );
  const back = () => setSub("hub");
  if (sub === "linear")
    return /* @__PURE__ */ jsx25(
      LinearForm,
      {
        draft,
        baseline,
        onChange,
        onBack: back
      }
    );
  if (sub === "todoTxt")
    return /* @__PURE__ */ jsx25(
      TodoTxtForm,
      {
        draft,
        baseline,
        onChange,
        onBack: back
      }
    );
  if (sub === "planKeeper")
    return /* @__PURE__ */ jsx25(
      PlanKeeperForm,
      {
        draft,
        baseline,
        onChange,
        onBack: back
      }
    );
  if (sub === "shell")
    return /* @__PURE__ */ jsx25(
      ShellSourcesForm,
      {
        draft,
        baseline,
        onChange,
        onBack: back
      }
    );
  const modified = taskSourceModified(draft, baseline);
  const rows = [
    {
      id: "linear",
      label: "Linear",
      status: isLinearEnabled(draft) ? "enabled" : "disabled",
      modified: modified.linear
    },
    {
      id: "todoTxt",
      label: "todo-txt",
      status: isTodoTxtEnabled(draft) ? "enabled" : "disabled",
      modified: modified.todoTxt
    },
    {
      id: "planKeeper",
      label: "PlanKeeper",
      status: isPlanKeeperEnabled(draft) ? "enabled" : "disabled",
      modified: modified.planKeeper
    },
    {
      id: "shell",
      label: "Shell sources",
      // Names (joined) instead of a bare count so the row can be scanned without
      // descending into the sub-form to see which sources are configured. Matches
      // the Home summary's shape (`sections.ts` → taskSources case).
      // `[].join(", ")` is "", so the `|| "none"` covers the empty case.
      status: shellSourceNames(draft).join(", ") || "none",
      modified: modified.shell
    }
  ];
  return /* @__PURE__ */ jsxs25(Box25, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx25(Text25, { bold: true, children: "Task Sources" }),
    /* @__PURE__ */ jsx25(Box25, { marginTop: 1, flexDirection: "column", children: rows.map((row, index) => /* @__PURE__ */ jsxs25(Box25, { children: [
      /* @__PURE__ */ jsx25(Text25, { color: cursor === index ? "cyan" : void 0, children: cursor === index ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsx25(Box25, { width: 20, children: /* @__PURE__ */ jsx25(Text25, { color: cursor === index ? "cyan" : void 0, children: row.label }) }),
      /* @__PURE__ */ jsx25(Text25, { dimColor: true, children: row.status }),
      row.modified ? /* @__PURE__ */ jsx25(Text25, { color: "yellow", children: " \u25CF" }) : null
    ] }, row.id)) }),
    /* @__PURE__ */ jsx25(Box25, { marginTop: 1, children: /* @__PURE__ */ jsx25(Text25, { dimColor: true, children: "Where groundcrew gets its to-do list. Turn on one or more sources of tasks for it to work through. \u2191/\u2193 move \xB7 enter open \xB7 esc back." }) })
  ] });
}

// src/screens/UsageForm.tsx
import { useState as useState20 } from "react";
import { Box as Box26, Text as Text26, useInput as useInput24 } from "ink";
import { jsx as jsx26, jsxs as jsxs26 } from "react/jsx-runtime";
function UsageForm({ draft, baseline, onChange, onBack }) {
  const disabled = isUsageDisabled(draft.agents);
  const hasAgents = Object.keys(draft.agents?.definitions ?? {}).length > 0;
  const [active, setActive] = useState20(0);
  const limit = draft.orchestrator?.sessionLimitPercentage;
  function setLimit(raw) {
    const value = raw.length === 0 ? void 0 : Number(raw);
    if (value !== void 0 && !Number.isFinite(value)) return;
    onChange(
      setByPath(
        draft,
        "orchestrator.sessionLimitPercentage",
        value
      )
    );
  }
  useInput24((input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setActive((a) => Math.min(1, a + 1));
    if (key.upArrow) setActive((a) => Math.max(0, a - 1));
    if (input === " " && active === 0 && hasAgents) {
      onChange({ ...draft, agents: setUsageDisabled(draft.agents, !disabled) });
    }
  });
  const limitModified = !valuesEqual(
    baseline.orchestrator?.sessionLimitPercentage,
    draft.orchestrator?.sessionLimitPercentage
  );
  const trackingModified = isUsageDisabled(baseline.agents) !== disabled;
  return /* @__PURE__ */ jsxs26(Box26, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx26(Text26, { bold: true, children: "Usage Limits" }),
    /* @__PURE__ */ jsx26(Box26, { marginTop: 1, children: /* @__PURE__ */ jsxs26(Text26, { color: active === 0 ? "cyan" : void 0, children: [
      active === 0 ? "\u203A " : "  ",
      "Usage tracking:",
      " ",
      /* @__PURE__ */ jsx26(Text26, { color: disabled ? "yellow" : "green", children: disabled ? "disabled" : "enabled" }),
      trackingModified ? /* @__PURE__ */ jsx26(Text26, { color: "yellow", children: " \u25CF" }) : null
    ] }) }),
    /* @__PURE__ */ jsx26(Box26, { marginTop: 1, children: /* @__PURE__ */ jsx26(
      TextField,
      {
        label: "sessionLimitPercentage",
        value: limit === void 0 ? "" : String(limit),
        placeholder: `${ORCHESTRATOR_DEFAULTS.sessionLimitPercentage}  (default)`,
        isActive: active === 1,
        modified: limitModified,
        onChange: setLimit
      }
    ) }),
    /* @__PURE__ */ jsxs26(Box26, { marginTop: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx26(Text26, { dimColor: true, children: "Usage tracking lets groundcrew watch your AI subscription's usage so it won't launch agents when you're near your limits. Disabling opts every enabled agent out; the limit % is the ceiling above which it stops launching new agents. \u2191/\u2193 move \xB7 space toggles tracking." }),
      /* @__PURE__ */ jsx26(Text26, { dimColor: true, children: "Needs the codexbar menu-bar app on Mac (groundcrew reads usage via its codexbar CLI). Install: brew install --cask steipete/tap/codexbar" }),
      hasAgents ? null : /* @__PURE__ */ jsx26(Text26, { dimColor: true, children: "(no enabled agents to gate \u2014 add one under Agents)" })
    ] })
  ] });
}

// src/screens/WorkspaceForm.tsx
import { useState as useState21 } from "react";
import { Box as Box27, Text as Text27, useInput as useInput25 } from "ink";
import { jsx as jsx27, jsxs as jsxs27 } from "react/jsx-runtime";
var FOCI = ["projectDir", "worktreeDir"];
function WorkspaceForm({ draft, baseline, onChange, onBack }) {
  const [focusIndex, setFocusIndex] = useState21(0);
  const focus = FOCI[focusIndex] ?? "projectDir";
  useInput25((_input, key) => {
    if (key.escape) onBack();
    if (key.downArrow) setFocusIndex((f) => Math.min(FOCI.length - 1, f + 1));
    if (key.upArrow) setFocusIndex((f) => Math.max(0, f - 1));
  });
  function setField(path11, value) {
    onChange(
      setByPath(
        draft,
        path11,
        value.length === 0 ? void 0 : value
      )
    );
  }
  const projectDirModified = !valuesEqual(
    baseline.workspace.projectDir,
    draft.workspace.projectDir
  );
  const worktreeDirModified = !valuesEqual(
    baseline.workspace.worktreeDir,
    draft.workspace.worktreeDir
  );
  return /* @__PURE__ */ jsxs27(Box27, { flexDirection: "column", borderStyle: "round", paddingX: 1, children: [
    /* @__PURE__ */ jsx27(Text27, { bold: true, children: "Workspace" }),
    /* @__PURE__ */ jsxs27(Box27, { flexDirection: "column", marginTop: 1, children: [
      /* @__PURE__ */ jsx27(
        TextField,
        {
          label: "projectDir",
          value: draft.workspace.projectDir,
          isActive: focus === "projectDir",
          modified: projectDirModified,
          onChange: (v) => setField("workspace.projectDir", v)
        }
      ),
      /* @__PURE__ */ jsx27(
        TextField,
        {
          label: "worktreeDir",
          value: draft.workspace.worktreeDir ?? "",
          placeholder: `${draft.workspace.projectDir}  (default)`,
          isActive: focus === "worktreeDir",
          modified: worktreeDirModified,
          onChange: (v) => setField("workspace.worktreeDir", v)
        }
      )
    ] }),
    /* @__PURE__ */ jsx27(Box27, { marginTop: 1, children: /* @__PURE__ */ jsx27(Text27, { dimColor: true, children: 'Where groundcrew keeps your code. projectDir is the folder that holds your repos; each task runs in a throwaway copy (a "git worktree") created under worktreeDir. Add the repos themselves in the Repositories section.' }) })
  ] });
}

// src/app.tsx
import { jsx as jsx28, jsxs as jsxs28 } from "react/jsx-runtime";
function Screen({
  rows,
  columns,
  footer,
  children
}) {
  return /* @__PURE__ */ jsxs28(Box28, { width: columns, height: rows, flexDirection: "column", children: [
    /* @__PURE__ */ jsx28(Box28, { flexGrow: 1, flexDirection: "column", children }),
    footer
  ] });
}
function App({ initialDraft: initialDraft2, target: target2 }) {
  const { exit } = useApp();
  const { rows, columns } = useFullscreen();
  const rawInitial = initialDraft2 ?? // Degenerate empty seed used when no config exists on disk; distinct from
  // defaultDraft(), the richer opinionated seed.
  {
    workspace: { projectDir: "", knownRepositories: [] }
  };
  const [draft, setDraft] = useState22(
    () => migratePlanKeeperSandboxPaths(rawInitial)
  );
  const [baseline, setBaseline] = useState22(() => rawInitial);
  const [route, setRoute] = useState22({ name: "home" });
  const [homeCursor, setHomeCursor] = useState22(0);
  const [dirty, setDirty] = useState22(false);
  const [valid, setValid] = useState22(true);
  const [checked, setChecked] = useState22(false);
  const [issues, setIssues] = useState22(/* @__PURE__ */ new Set());
  const [saved, setSaved] = useState22(false);
  const [shadowed, setShadowed] = useState22([]);
  const [quitting, setQuitting] = useState22(false);
  const configPath2 = targetPath(target2);
  useEffect3(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void validateDraft(draft, path6.dirname(targetPath(target2))).then((result) => {
        if (cancelled) return;
        setChecked(true);
        setValid(result.ok);
        setIssues(
          result.ok || result.section === void 0 ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([result.section])
        );
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);
  function update(next) {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  }
  async function save() {
    const result = await saveDraft(target2, draft);
    setBaseline(draft);
    setDirty(false);
    setSaved(true);
    setShadowed(result.shadowed);
  }
  useInput26(
    (input) => {
      if (route.name !== "home") return;
      if (input === "s") void save();
      if (input === "q") {
        if (dirty) setQuitting(true);
        else exit();
      }
    },
    { isActive: route.name === "home" && !quitting }
  );
  const modified = useMemo2(
    () => modifiedSections(baseline, draft),
    [baseline, draft]
  );
  if (quitting) {
    return /* @__PURE__ */ jsx28(Screen, { rows, columns, children: /* @__PURE__ */ jsx28(
      QuitGuard,
      {
        onSaveQuit: () => void save().then(() => exit()),
        onDiscard: () => exit(),
        onCancel: () => setQuitting(false)
      }
    ) });
  }
  const noSources = enabledSourceCount(draft) === 0;
  const homeIssues = noSources ? /* @__PURE__ */ new Set([...issues, "taskSources"]) : issues;
  if (route.name === "home") {
    return /* @__PURE__ */ jsxs28(
      Screen,
      {
        rows,
        columns,
        footer: /* @__PURE__ */ jsx28(
          Footer,
          {
            dirty,
            issues: issues.size,
            valid,
            checked,
            noSources,
            hint: "\u2191/\u2193 move \xB7 enter edit \xB7 s save \xB7 q quit"
          }
        ),
        children: [
          /* @__PURE__ */ jsxs28(Box28, { justifyContent: "space-between", children: [
            /* @__PURE__ */ jsx28(Text28, { bold: true, children: "crew-config" }),
            /* @__PURE__ */ jsx28(Text28, { dimColor: true, children: target2.scope })
          ] }),
          /* @__PURE__ */ jsx28(Box28, { children: /* @__PURE__ */ jsxs28(Text28, { dimColor: true, children: [
            "editing",
            " ",
            /* @__PURE__ */ jsx28(Text28, { color: saved ? "green" : void 0, children: configPath2 }),
            saved ? /* @__PURE__ */ jsx28(Text28, { color: "green", children: " \u2713 saved" }) : null,
            saved && shadowed.length > 0 ? /* @__PURE__ */ jsxs28(Text28, { dimColor: true, children: [
              " (moved ",
              shadowed.join(", "),
              ")"
            ] }) : null
          ] }) }),
          /* @__PURE__ */ jsx28(Box28, { marginTop: 1, children: /* @__PURE__ */ jsx28(Text28, { dimColor: true, children: "groundcrew picks up your tasks and runs AI coding agents on them automatically \u2014 each in its own isolated copy of your repo \u2014 then opens a PR. Set it up below." }) }),
          /* @__PURE__ */ jsx28(Box28, { marginTop: 1, children: /* @__PURE__ */ jsx28(
            Home,
            {
              draft,
              issues: homeIssues,
              modified,
              cursor: homeCursor,
              onCursorChange: setHomeCursor,
              onOpen: (id2) => setRoute({ name: "section", id: id2 })
            }
          ) })
        ]
      }
    );
  }
  const id = route.id;
  const back = () => setRoute({ name: "home" });
  const configDir = path6.dirname(targetPath(target2));
  const form = id === "workspace" ? /* @__PURE__ */ jsx28(
    WorkspaceForm,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  ) : id === "repositories" ? /* @__PURE__ */ jsx28(
    RepositoriesForm,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  ) : id === "taskSources" ? /* @__PURE__ */ jsx28(
    TaskSourcesMenu,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  ) : id === "usage" ? /* @__PURE__ */ jsx28(
    UsageForm,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  ) : id === "agents" ? /* @__PURE__ */ jsx28(
    AgentsForm,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  ) : id === "prompts" ? /* @__PURE__ */ jsx28(
    PromptsScreen,
    {
      draft,
      baseline,
      onChange: update,
      onBack: back,
      configDir
    }
  ) : /* @__PURE__ */ jsx28(
    SectionForm,
    {
      title: SECTION_LABEL[id],
      description: SECTION_DESCRIPTION[id],
      spec: simpleSectionSpec(id),
      draft,
      baseline,
      onChange: update,
      onBack: back
    }
  );
  return /* @__PURE__ */ jsx28(Screen, { rows, columns, children: form });
}

// src/io/load.ts
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "fs";
import path7 from "path";
import { pathToFileURL } from "url";
import { cosmiconfig } from "cosmiconfig";
var importModule = async (filepath) => {
  const mod = await import(pathToFileURL(filepath).href);
  return mod.default ?? null;
};
var explorer = cosmiconfig("crew", {
  loaders: { ".ts": importModule, ".mjs": importModule, ".js": importModule }
});
async function loadDraft(filepath) {
  if (!existsSync3(filepath)) return void 0;
  if (path7.extname(filepath) === ".json") {
    const text = readFileSync2(filepath, "utf8");
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Invalid JSON in ${filepath}: ${error.message}`,
        { cause: error }
      );
    }
  }
  const result = await explorer.load(filepath);
  return result?.config ?? void 0;
}

// src/io/locate.ts
import { existsSync as existsSync4 } from "fs";
import path8 from "path";
var CONFIG_BASENAMES = [
  "crew.config.ts",
  "crew.config.mjs",
  "crew.config.js",
  "crew.config.json"
];
function locate(argv2, cwd) {
  const unknown = argv2.find((a) => a.startsWith("-") && a !== "--local");
  if (unknown !== void 0) {
    throw new Error(`unknown flag: ${unknown}`);
  }
  const explicit = argv2.find((a) => !a.startsWith("-"));
  const scope = argv2.includes("--local") ? "local" : "global";
  const target2 = { scope, cwd };
  if (explicit !== void 0) {
    return { target: target2, path: path8.resolve(cwd, explicit) };
  }
  const dir = path8.dirname(targetPath(target2));
  const existing = CONFIG_BASENAMES.map((name) => path8.join(dir, name)).find(
    existsSync4
  );
  return { target: target2, path: existing ?? targetPath(target2) };
}

// src/io/seed.ts
import { existsSync as existsSync5, mkdirSync as mkdirSync3, writeFileSync as writeFileSync4 } from "fs";
import path9 from "path";

// src/domain/defaults.ts
var DEFAULT_PROMPT_FILE = "prompt-initial.md";
var DEFAULT_INITIAL_PROMPT = [
  "You are working on task {{task}} ({{title}}) in the {{worktree}} worktree subdirectory.",
  "",
  "## Task description",
  "",
  "<task_description>",
  "{{description}}",
  "</task_description>",
  "",
  "## Operating mode",
  "",
  "There is no human watching this session. Do not stop to ask clarifying questions. When the task is ambiguous or incomplete, choose the simplest reasonable interpretation consistent with the task and the codebase, then document that choice in the output.",
  "{{workspaceContinuationInstruction}}",
  "",
  "## Workflow",
  "",
  "1. Inspect the repo instructions and existing patterns before edits.",
  "2. Implement the smallest sensible change that completes the task.",
  "3. Run the repo's documented verification command. If no documented command exists, run the smallest relevant test suite you can find and fix failures you introduced before continuing.",
  "4. Follow the task description for output. If no output instructions exist, open a PR with `Closes {{task}}` in the description. If you cannot open one, leave the branch ready and record the blocker.",
  ""
].join("\n");
function defaultDraft() {
  return {
    workspace: {
      projectDir: "~/groundcrew",
      worktreeDir: "~/groundcrew/workspaces",
      knownRepositories: []
    },
    agents: {
      default: "claude",
      definitions: { claude: { usage: { disabled: true } } }
    },
    workspaceKind: "tmux",
    local: { runner: "safehouse" },
    prompts: { promptFile: DEFAULT_PROMPT_FILE }
  };
}

// src/io/seed.ts
function seedNewConfig(target2) {
  const dir = path9.dirname(targetPath(target2));
  const promptPath = path9.join(dir, DEFAULT_PROMPT_FILE);
  try {
    if (!existsSync5(promptPath)) {
      mkdirSync3(dir, { recursive: true });
      writeFileSync4(promptPath, DEFAULT_INITIAL_PROMPT);
    }
  } catch {
    return { ...defaultDraft(), prompts: { initial: DEFAULT_INITIAL_PROMPT } };
  }
  return defaultDraft();
}

// src/io/upgrade.ts
import { spawnSync } from "child_process";
import { realpathSync } from "fs";
import path10 from "path";
var BREW_FORMULA = "paulbaranowski/tap/crew-config";
var INSTALLER_URL = "https://github.com/paulbaranowski/groundcrew-config/releases/latest/download/install.sh";
var INSTALLER_PIPELINE = `curl -fsSL ${INSTALLER_URL} | bash`;
function isContained(child, parent) {
  if (parent === "") return false;
  const rel = path10.relative(parent, child);
  return rel === "" || !rel.startsWith("..") && !path10.isAbsolute(rel);
}
function detectChannel(input) {
  if (isContained(input.scriptRealpath, input.brewFormulaPrefix)) return "brew";
  if (isContained(input.scriptRealpath, input.npmGlobalPrefix)) {
    return "installer";
  }
  return "unknown";
}
function commandFor(channel) {
  if (channel === "brew") {
    return {
      echo: `brew upgrade ${BREW_FORMULA}`,
      cmd: "brew",
      args: ["upgrade", BREW_FORMULA]
    };
  }
  if (channel === "installer") {
    return {
      echo: INSTALLER_PIPELINE,
      cmd: "bash",
      args: ["-c", INSTALLER_PIPELINE]
    };
  }
  return null;
}
function guidanceText() {
  return [
    "Could not determine how crew-config was installed (it looks like a source",
    "checkout or an unrecognized location), so nothing was changed.",
    "",
    "Upgrade manually with whichever matches your install:",
    `  Homebrew:  brew upgrade ${BREW_FORMULA}`,
    `  Installer: ${INSTALLER_PIPELINE}`
  ].join("\n");
}
function tryRealpath(p, realpath) {
  try {
    return realpath(p);
  } catch {
    return "";
  }
}
function prefixFromCommand(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error || r.status !== 0 || typeof r.stdout !== "string") return "";
  const out = r.stdout.trim();
  if (out === "") return "";
  return tryRealpath(out, realpathSync);
}
function defaultDeps() {
  return {
    scriptPath: process.argv[1] ?? "",
    realpath: realpathSync,
    brewFormulaPrefix: () => prefixFromCommand("brew", ["--prefix", "crew-config"]),
    npmGlobalPrefix: () => prefixFromCommand("npm", ["prefix", "-g"]),
    run: (cmd, args) => spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1,
    log: (message) => console.log(message)
  };
}
function runUpgrade(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const scriptRealpath = tryRealpath(d.scriptPath, d.realpath);
  const channel = detectChannel({
    scriptRealpath,
    brewFormulaPrefix: d.brewFormulaPrefix(),
    npmGlobalPrefix: d.npmGlobalPrefix()
  });
  const command = commandFor(channel);
  if (command === null) {
    d.log(guidanceText());
    return 1;
  }
  d.log(`Upgrading crew-config via: ${command.echo}`);
  return d.run(command.cmd, command.args);
}

// src/meta.ts
import { readFileSync as readFileSync3 } from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
var HELP = `crew-config \u2014 interactive editor for groundcrew's crew.config.json

Usage:
  crew-config            edit the global ~/.config/groundcrew/crew.config.json
  crew-config --local    edit ./crew.config.json in the current project
  crew-config <path>     edit the crew.config.json at <path>
  crew-config upgrade    upgrade crew-config to the latest version

Flags:
  -h, --help       show this help and exit
  -v, --version    print the version and exit`;
function readVersion() {
  const pkgPath = fileURLToPath2(new URL("../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync3(pkgPath, "utf8"));
  return pkg.version;
}
function metaOutput(argv2) {
  if (argv2.includes("--version") || argv2.includes("-v")) return readVersion();
  if (argv2.includes("--help") || argv2.includes("-h")) return HELP;
  return null;
}

// src/cli.tsx
import { jsx as jsx29 } from "react/jsx-runtime";
var argv = process.argv.slice(2);
var meta = metaOutput(argv);
if (meta !== null) {
  console.log(meta);
  process.exit(0);
}
if (argv[0] === "upgrade") {
  process.exit(runUpgrade());
}
var { target, path: configPath } = locate(argv, process.cwd());
var initialDraft = await loadDraft(configPath) ?? seedNewConfig(target);
var dispose = installFullscreen(createFullscreen(process.stdout));
try {
  const instance = render(/* @__PURE__ */ jsx29(App, { initialDraft, target }));
  await instance.waitUntilExit();
} finally {
  dispose();
}
