import { expect, test } from "vitest";
import {
  SECTION_LABEL,
  SECTION_ORDER,
  sectionSummary,
  simpleSectionSpec,
} from "./sections.ts";

test("section order is the Home list order", () => {
  expect(SECTION_ORDER).toEqual([
    "repositories",
    "workspace",
    "taskSources",
    "agents",
    "terminal",
    "sandbox",
    "orchestrator",
    "usage",
    "hooks",
    "git",
    "prompts",
    "advanced",
  ]);
});

test("workspace summary shows projectDir and the configured worktreeDir", () => {
  expect(
    sectionSummary("workspace", {
      workspace: {
        projectDir: "~/dev/groundcrew",
        worktreeDir: "~/dev/worktrees",
        knownRepositories: ["a/b"],
      },
    } as never),
  ).toBe("~/dev/groundcrew · worktreeDir: ~/dev/worktrees");
});

test("workspace summary falls back to projectDir when worktreeDir is unset", () => {
  expect(
    sectionSummary("workspace", {
      workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
    } as never),
  ).toBe("~/dev/groundcrew · worktreeDir: ~/dev/groundcrew");
});

test("repositories summary shows the repo count", () => {
  expect(
    sectionSummary("repositories", {
      workspace: {
        projectDir: "~/dev/groundcrew",
        knownRepositories: ["a/b", "c/d"],
      },
    } as never),
  ).toBe("2 repos");
});

test("terminal summary shows workspaceKind", () => {
  expect(
    sectionSummary("terminal", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      workspaceKind: "tmux",
    } as never),
  ).toBe("workspaceKind: tmux");
});

test("usage summary reflects tracking state", () => {
  expect(
    sectionSummary("usage", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      agents: {
        default: "claude",
        definitions: { claude: { usage: { disabled: true } } },
      },
    } as never),
  ).toBe("tracking disabled");
  expect(
    sectionSummary("usage", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      agents: { default: "claude", definitions: { claude: {} } },
    } as never),
  ).toBe("tracking enabled · limit 85%");
});

test("terminal is a select spec over the workspaceKind enum", () => {
  const spec = simpleSectionSpec("terminal");
  expect(spec[0]?.kind).toBe("select");
  expect(spec[0]?.options).toEqual(["auto", "cmux", "tmux", "zellij"]);
});

test("advanced no longer includes workspaceKind", () => {
  const spec = simpleSectionSpec("advanced");
  expect(spec.some((f) => f.path === "workspaceKind")).toBe(false);
  expect(spec.some((f) => f.path === "logging.file")).toBe(true);
});

test("prompts is an initial + promptFile spec", () => {
  const spec = simpleSectionSpec("prompts");
  expect(spec.map((f) => f.path)).toEqual([
    "prompts.initial",
    "prompts.promptFile",
  ]);
});

test("prompts summary prefers promptFile over initial", () => {
  const base = { workspace: { projectDir: "~/d", knownRepositories: [] } };
  expect(
    sectionSummary("prompts", {
      ...base,
      prompts: { promptFile: "./prompt.md" },
    } as never),
  ).toBe("file: ./prompt.md");
  expect(
    sectionSummary("prompts", {
      ...base,
      prompts: { initial: "hello" },
    } as never),
  ).toBe("custom (5 chars)");
  expect(sectionSummary("prompts", base as never)).toBe("default");
  // With both set, promptFile wins (the summary's documented precedence).
  expect(
    sectionSummary("prompts", {
      ...base,
      prompts: { promptFile: "./prompt.md", initial: "hello" },
    } as never),
  ).toBe("file: ./prompt.md");
});

test("orchestrator summary shows ghosted defaults when unset", () => {
  expect(
    sectionSummary("orchestrator", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
    } as never),
  ).toBe("max 4 · poll 120s");
});

test("the session limit moved out of the orchestrator spec into Usage Limits", () => {
  const spec = simpleSectionSpec("orchestrator");
  expect(spec.map((f) => f.label)).toEqual([
    "maximumInProgress",
    "pollIntervalMilliseconds",
  ]);
  expect(SECTION_LABEL.usage).toBe("Usage Limits");
});

test("usage summary shows the configured session limit when tracking is on", () => {
  expect(
    sectionSummary("usage", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      agents: { default: "claude", definitions: { claude: {} } },
      orchestrator: { sessionLimitPercentage: 50 },
    } as never),
  ).toBe("tracking enabled · limit 50%");
});

test("sandbox is a runner + networkEgress select spec", () => {
  const spec = simpleSectionSpec("sandbox");
  expect(spec.map((f) => f.path)).toEqual([
    "local.runner",
    "local.networkEgress",
  ]);
  expect(spec[0]?.kind).toBe("select");
  expect(spec[0]?.options).toEqual(["auto", "safehouse", "srt", "sdx", "none"]);
  expect(spec[1]?.kind).toBe("select");
  expect(spec[1]?.options).toEqual(["allowlisted", "open"]);
});

test("sandbox summary always shows runner and egress, with defaults when unset", () => {
  const base = { workspace: { projectDir: "~/d", knownRepositories: [] } };
  expect(sectionSummary("sandbox", base as never)).toBe(
    "runner: auto · egress: allowlisted",
  );
  expect(
    sectionSummary("sandbox", {
      ...base,
      local: { runner: "safehouse", networkEgress: "open" },
    } as never),
  ).toBe("runner: safehouse · egress: open");
});

test("taskSources summary lists enabled source kinds", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [{ kind: "linear" }, { kind: "todo-txt" }],
    } as never),
  ).toBe("linear, todo-txt");
});

test("taskSources summary names each generic shell source", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [
        { kind: "linear", enabled: false },
        { kind: "shell", name: "jira" },
        { kind: "shell", name: "github" },
      ],
    } as never),
  ).toBe("jira, github");
});

test("taskSources summary falls back to 'shell' for a blank-named shell source", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [{ kind: "shell", name: "" }],
    } as never),
  ).toBe("shell");
});

test("taskSources summary warns when no sources are enabled", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
    } as never),
  ).toBe("none — crew won't run");
});

test("taskSources summary names enabled by-kind manifest sources", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [{ kind: "linear" }, { kind: "jira" }],
    } as never),
  ).toBe("linear, jira");
});

test("taskSources summary omits a disabled by-kind manifest source", () => {
  expect(
    sectionSummary("taskSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [{ kind: "linear" }, { kind: "jira", enabled: false }],
    } as never),
  ).toBe("linear");
});
