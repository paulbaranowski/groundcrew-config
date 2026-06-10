import { expect, test } from "vitest";
import { BUILTIN_AGENTS, isAgentEnabled, setAgentEnabled } from "./agents.ts";

test("BUILTIN_AGENTS lists claude then codex", () => {
  expect(BUILTIN_AGENTS).toEqual(["claude", "codex"]);
});

test("an agent is enabled when present in definitions", () => {
  const agents = { default: "claude", definitions: { claude: {} } } as never;
  expect(isAgentEnabled(agents, "claude")).toBe(true);
  expect(isAgentEnabled(agents, "codex")).toBe(false);
});

test("nothing is enabled when agents is undefined", () => {
  expect(isAgentEnabled(undefined, "claude")).toBe(false);
});

test("enabling an agent adds an empty definition (built-in preset)", () => {
  const agents = { default: "claude", definitions: { claude: {} } } as never;
  const next = setAgentEnabled(agents, "codex", true);
  expect(next?.definitions).toEqual({ claude: {}, codex: {} });
});

test("disabling an agent removes its definition", () => {
  const agents = {
    default: "claude",
    definitions: { claude: {}, codex: {} },
  } as never;
  const next = setAgentEnabled(agents, "codex", false);
  expect(next?.definitions).toEqual({ claude: {} });
});

test("disabling preserves sibling definitions and the default field", () => {
  const agents = {
    default: "claude",
    definitions: {
      claude: { cmd: "claude --permission-mode bypassPermissions" },
      codex: {},
    },
  } as never;
  const next = setAgentEnabled(agents, "codex", false);
  expect(next).toEqual({
    default: "claude",
    definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
  });
});

test("enabling an already-enabled agent leaves its definition untouched", () => {
  const agents = {
    default: "claude",
    definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
  } as never;
  const next = setAgentEnabled(agents, "claude", true);
  expect(next?.definitions).toEqual({
    claude: { cmd: "claude --permission-mode bypassPermissions" },
  });
});

test("enabling from an undefined agents object yields a definitions map", () => {
  const next = setAgentEnabled(undefined, "claude", true);
  expect(next?.definitions).toEqual({ claude: {} });
});
