import { expect, test } from "vitest";
import { BUILTIN_MODELS, isModelEnabled, setModelEnabled } from "./models.ts";

test("BUILTIN_MODELS lists claude then codex", () => {
  expect(BUILTIN_MODELS).toEqual(["claude", "codex"]);
});

test("a model is enabled when present in definitions", () => {
  const models = { default: "claude", definitions: { claude: {} } } as never;
  expect(isModelEnabled(models, "claude")).toBe(true);
  expect(isModelEnabled(models, "codex")).toBe(false);
});

test("nothing is enabled when models is undefined", () => {
  expect(isModelEnabled(undefined, "claude")).toBe(false);
});

test("enabling a model adds an empty definition (built-in preset)", () => {
  const models = { default: "claude", definitions: { claude: {} } } as never;
  const next = setModelEnabled(models, "codex", true);
  expect(next?.definitions).toEqual({ claude: {}, codex: {} });
});

test("disabling a model removes its definition", () => {
  const models = {
    default: "claude",
    definitions: { claude: {}, codex: {} },
  } as never;
  const next = setModelEnabled(models, "codex", false);
  expect(next?.definitions).toEqual({ claude: {} });
});

test("disabling preserves sibling definitions and the default field", () => {
  const models = {
    default: "claude",
    definitions: {
      claude: { cmd: "claude --permission-mode bypassPermissions" },
      codex: {},
    },
  } as never;
  const next = setModelEnabled(models, "codex", false);
  expect(next).toEqual({
    default: "claude",
    definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
  });
});

test("enabling an already-enabled model leaves its definition untouched", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
  } as never;
  const next = setModelEnabled(models, "claude", true);
  expect(next?.definitions).toEqual({
    claude: { cmd: "claude --permission-mode bypassPermissions" },
  });
});

test("enabling from an undefined models object yields a definitions map", () => {
  const next = setModelEnabled(undefined, "claude", true);
  expect(next?.definitions).toEqual({ claude: {} });
});
