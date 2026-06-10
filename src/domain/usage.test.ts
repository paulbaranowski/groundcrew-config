import { expect, test } from "vitest";
import { isUsageDisabled, setUsageDisabled } from "./usage.ts";

test("empty definitions are not considered disabled", () => {
  expect(isUsageDisabled(undefined)).toBe(false);
  expect(isUsageDisabled({ default: "claude", definitions: {} })).toBe(false);
});

test("disabled only when every enabled agent carries the sentinel", () => {
  const agents = { default: "claude", definitions: { claude: {}, codex: {} } };
  const off = setUsageDisabled(agents, true);
  expect(off?.definitions).toEqual({
    claude: { usage: { disabled: true } },
    codex: { usage: { disabled: true } },
  });
  expect(isUsageDisabled(off)).toBe(true);
});

test("disabling from a mixed state opts every agent out (overwriting any usage block)", () => {
  // Documents the intended semantics: "disable usage tracking" replaces each
  // agent's usage with the opt-out sentinel. An agent carrying a real codexbar
  // block is overwritten — groundcrew's usage is a union, so it cannot hold both
  // codexbar config and the disabled sentinel at once.
  const agents = {
    default: "claude",
    definitions: {
      claude: { usage: { disabled: true } },
      codex: { cmd: "codex", usage: { codexbar: { provider: "anthropic" } } },
    },
  } as never;
  expect(isUsageDisabled(agents)).toBe(false); // mixed → not fully disabled
  const off = setUsageDisabled(agents, true);
  expect(off?.definitions).toEqual({
    claude: { usage: { disabled: true } },
    codex: { cmd: "codex", usage: { disabled: true } },
  });
  expect(isUsageDisabled(off)).toBe(true);
});

test("re-enabling removes only the disabled sentinel, preserving other fields", () => {
  const agents = {
    default: "claude",
    definitions: { claude: { cmd: "claude", usage: { disabled: true } } },
  } as never;
  const on = setUsageDisabled(agents, false);
  expect(on?.definitions).toEqual({ claude: { cmd: "claude" } });
  expect(isUsageDisabled(on)).toBe(false);
});
