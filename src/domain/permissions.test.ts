import { expect, test } from "vitest";
import { isBypassEnabled, isClaudeModel, setBypass } from "./permissions.ts";

test("an empty claude entry is a claude model defaulting to auto (bypass off)", () => {
  // `claude: {}` inherits the built-in `claude --permission-mode auto` preset.
  expect(isClaudeModel("claude", {})).toBe(true);
  expect(isBypassEnabled("claude", {})).toBe(false);
});

test("an explicit bypassPermissions cmd reads as enabled", () => {
  const def = { cmd: "claude --permission-mode bypassPermissions" };
  expect(isClaudeModel("claude", def)).toBe(true);
  expect(isBypassEnabled("claude", def)).toBe(true);
});

test("an explicit auto cmd reads as disabled", () => {
  const def = { cmd: "claude --permission-mode auto" };
  expect(isBypassEnabled("claude", def)).toBe(false);
});

test("codex is not a claude model and is left for raw JSON", () => {
  const def = { cmd: "codex --dangerously-bypass-approvals-and-sandbox" };
  expect(isClaudeModel("codex", def)).toBe(false);
});

test("a claude binary given by absolute path is still detected", () => {
  const def = { cmd: "/usr/local/bin/claude --permission-mode auto" };
  expect(isClaudeModel("claude", def)).toBe(true);
});

test("enabling bypass replaces the permission-mode value, preserving other args", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude --model opus --permission-mode auto" } },
  } as never;
  const on = setBypass(models, "claude", true);
  expect(on?.definitions).toEqual({
    claude: { cmd: "claude --model opus --permission-mode bypassPermissions" },
  });
  expect(isBypassEnabled("claude", on?.definitions?.claude)).toBe(true);
});

test("disabling bypass sets the permission-mode value back to auto", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
  } as never;
  const off = setBypass(models, "claude", false);
  expect(off?.definitions).toEqual({
    claude: { cmd: "claude --permission-mode auto" },
  });
  expect(isBypassEnabled("claude", off?.definitions?.claude)).toBe(false);
});

test("enabling on an empty entry writes a full claude cmd", () => {
  const models = { default: "claude", definitions: { claude: {} } } as never;
  const on = setBypass(models, "claude", true);
  expect(on?.definitions).toEqual({
    claude: { cmd: "claude --permission-mode bypassPermissions" },
  });
});

test("enabling on a cmd with no permission-mode flag appends it", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude --model opus" } },
  } as never;
  const on = setBypass(models, "claude", true);
  expect(on?.definitions).toEqual({
    claude: { cmd: "claude --model opus --permission-mode bypassPermissions" },
  });
});

test("setBypass preserves sibling model definitions untouched", () => {
  const models = {
    default: "claude",
    definitions: {
      claude: { cmd: "claude --permission-mode auto" },
      codex: { cmd: "codex --dangerously-bypass-approvals-and-sandbox" },
    },
  } as never;
  const on = setBypass(models, "claude", true);
  expect(on?.definitions?.codex).toEqual({
    cmd: "codex --dangerously-bypass-approvals-and-sandbox",
  });
});
