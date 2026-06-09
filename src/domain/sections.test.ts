import { expect, test } from "vitest";
import {
  SECTION_ORDER,
  sectionSummary,
  simpleSectionSpec,
} from "./sections.ts";

test("section order is the Home list order", () => {
  expect(SECTION_ORDER).toEqual([
    "workspace",
    "repositories",
    "models",
    "ticketSources",
    "orchestrator",
    "usage",
    "hooks",
    "git",
    "terminal",
    "sandbox",
    "prompts",
    "advanced",
  ]);
});

test("workspace summary shows projectDir only", () => {
  expect(
    sectionSummary("workspace", {
      workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
    } as never),
  ).toBe("~/dev/groundcrew");
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
      models: {
        default: "claude",
        definitions: { claude: { usage: { disabled: true } } },
      },
    } as never),
  ).toBe("tracking disabled");
  expect(
    sectionSummary("usage", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      models: { default: "claude", definitions: { claude: {} } },
    } as never),
  ).toBe("tracking enabled");
});

test("terminal is a select spec over the workspaceKind enum", () => {
  const spec = simpleSectionSpec("terminal");
  expect(spec[0]?.kind).toBe("select");
  expect(spec[0]?.options).toEqual(["auto", "cmux", "tmux"]);
});

test("advanced no longer includes workspaceKind", () => {
  const spec = simpleSectionSpec("advanced");
  expect(spec.some((f) => f.path === "workspaceKind")).toBe(false);
  expect(spec.some((f) => f.path === "logging.file")).toBe(true);
});

test("orchestrator summary shows ghosted defaults when unset", () => {
  expect(
    sectionSummary("orchestrator", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
    } as never),
  ).toBe("max 4 · poll 120s · limit 85%");
});

test("sandbox is a select field spec over the runner enum", () => {
  const spec = simpleSectionSpec("sandbox");
  expect(spec[0]?.kind).toBe("select");
  expect(spec[0]?.options).toEqual(["auto", "safehouse", "srt", "sdx", "none"]);
});

test("ticketSources summary lists enabled source kinds", () => {
  expect(
    sectionSummary("ticketSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [{ kind: "linear" }, { kind: "todo-txt" }],
    } as never),
  ).toBe("linear, todo-txt");
});

test("ticketSources summary warns when no sources are enabled", () => {
  expect(
    sectionSummary("ticketSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
    } as never),
  ).toBe("none — crew won't run");
});
