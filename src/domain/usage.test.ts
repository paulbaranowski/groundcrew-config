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

test("re-enabling removes only the disabled sentinel, preserving other fields", () => {
  const models = {
    default: "claude",
    definitions: { claude: { cmd: "claude", usage: { disabled: true } } },
  };
  const on = setUsageDisabled(models, false);
  expect(on?.definitions).toEqual({ claude: { cmd: "claude" } });
  expect(isUsageDisabled(on)).toBe(false);
});
