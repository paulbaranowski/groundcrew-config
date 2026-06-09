import { expect, test } from "vitest";
import { isUsageDisabled, setUsageDisabled } from "./usage.ts";

test("empty definitions are not considered disabled", () => {
  expect(isUsageDisabled(undefined)).toBe(false);
  expect(isUsageDisabled({ default: "claude", definitions: {} })).toBe(false);
});

test("disabled only when every enabled model carries the sentinel", () => {
  const models = { default: "claude", definitions: { claude: {}, codex: {} } };
  const off = setUsageDisabled(models, true);
  expect(off?.definitions).toEqual({
    claude: { usage: { disabled: true } },
    codex: { usage: { disabled: true } },
  });
  expect(isUsageDisabled(off)).toBe(true);
});

test("disabling from a mixed state opts every model out (overwriting any usage block)", () => {
  // Documents the intended semantics: "disable usage tracking" replaces each
  // model's usage with the opt-out sentinel. A model carrying a real codexbar
  // block is overwritten — groundcrew's usage is a union, so it cannot hold both
  // codexbar config and the disabled sentinel at once.
  const models = {
    default: "claude",
    definitions: {
      claude: { usage: { disabled: true } },
      codex: { cmd: "codex", usage: { codexbar: { provider: "anthropic" } } },
    },
  } as never;
  expect(isUsageDisabled(models)).toBe(false); // mixed → not fully disabled
  const off = setUsageDisabled(models, true);
  expect(off?.definitions).toEqual({
    claude: { usage: { disabled: true } },
    codex: { cmd: "codex", usage: { disabled: true } },
  });
  expect(isUsageDisabled(off)).toBe(true);
});

test("re-enabling removes only the disabled sentinel, preserving other fields", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude", usage: { disabled: true } } },
  } as never;
  const on = setUsageDisabled(models, false);
  expect(on?.definitions).toEqual({ claude: { cmd: "claude" } });
  expect(isUsageDisabled(on)).toBe(false);
});
