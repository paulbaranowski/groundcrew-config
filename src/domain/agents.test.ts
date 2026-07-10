import { expect, test } from "vitest";
import {
  applyAgentFields,
  BUILTIN_AGENTS,
  getAgentDef,
  isAgentEnabled,
  readAgentFields,
  runnerRequiresSandbox,
  setAgentDef,
  setAgentEnabled,
} from "./agents.ts";

test("BUILTIN_AGENTS lists claude, codex, then cursor", () => {
  expect(BUILTIN_AGENTS).toEqual(["claude", "codex", "cursor"]);
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

test("getAgentDef returns the entry or an empty object", () => {
  const agents = { definitions: { claude: { cmd: "x" } } } as never;
  expect(getAgentDef(agents, "claude")).toEqual({ cmd: "x" });
  expect(getAgentDef(agents, "codex")).toEqual({});
  expect(getAgentDef(undefined, "claude")).toEqual({});
  // A stray array (e.g. from a raw-JSON edit) is not a definition.
  expect(getAgentDef({ definitions: { claude: [] } } as never, "claude")).toEqual({});
});

test("setAgentDef enables a previously-absent agent by writing its def", () => {
  const next = setAgentDef(undefined, "cursor", { cmd: "cursor-agent", color: "#999" });
  expect(next?.definitions).toEqual({
    cursor: { cmd: "cursor-agent", color: "#999" },
  });
});

test("readAgentFields flattens cmd/color/preLaunch, env list, and sandbox.agent", () => {
  expect(
    readAgentFields({
      cmd: "claude",
      color: "#C15F3C",
      preLaunch: "export T=$(mint)",
      preLaunchEnv: ["T", "U"],
      sandbox: { agent: "claude" },
    }),
  ).toEqual({
    cmd: "claude",
    color: "#C15F3C",
    preLaunch: "export T=$(mint)",
    preLaunchEnv: "T, U",
    sandboxAgent: "claude",
  });
  // Missing fields read as empty strings.
  expect(readAgentFields({})).toEqual({
    cmd: "",
    color: "",
    preLaunch: "",
    preLaunchEnv: "",
    sandboxAgent: "",
  });
});

test("applyAgentFields parses the env list and nests sandbox.agent", () => {
  const def = applyAgentFields(
    {},
    {
      cmd: "claude --permission-mode auto",
      color: "#C15F3C",
      preLaunch: "export T=$(mint)",
      preLaunchEnv: "T , U,",
      sandboxAgent: "claude",
    },
  );
  expect(def).toEqual({
    cmd: "claude --permission-mode auto",
    color: "#C15F3C",
    preLaunch: "export T=$(mint)",
    preLaunchEnv: ["T", "U"],
    sandbox: { agent: "claude" },
  });
});

test("applyAgentFields clears emptied keys and drops the sandbox block", () => {
  const def = applyAgentFields(
    { cmd: "old", preLaunchEnv: ["X"], sandbox: { agent: "claude" } },
    { cmd: "", color: "", preLaunch: "", preLaunchEnv: " ", sandboxAgent: "" },
  );
  expect(def).toEqual({});
});

test("runnerRequiresSandbox: sdx always, auto only on linux", () => {
  expect(runnerRequiresSandbox("sdx", "darwin")).toBe(true);
  expect(runnerRequiresSandbox("auto", "linux")).toBe(true);
  expect(runnerRequiresSandbox(undefined, "linux")).toBe(true);
  expect(runnerRequiresSandbox("auto", "darwin")).toBe(false);
  expect(runnerRequiresSandbox("safehouse", "linux")).toBe(false);
  expect(runnerRequiresSandbox("none", "linux")).toBe(false);
});
