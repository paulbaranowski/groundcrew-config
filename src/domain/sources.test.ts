import { expect, test } from "vitest";
import {
  customSourceCount,
  isLinearDisabled,
  isPlanKeeperEnabled,
  planKeeperSource,
  setLinearEnabled,
  setPlanKeeperEnabled,
} from "./sources.ts";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("linear defaults to enabled, toggles to a disabling entry and back", () => {
  expect(isLinearDisabled(base)).toBe(false);
  const off = setLinearEnabled(base, false);
  expect(off.sources).toEqual([{ kind: "linear", enabled: false }]);
  expect(isLinearDisabled(off)).toBe(true);
  const on = setLinearEnabled(off, true);
  expect(isLinearDisabled(on)).toBe(false);
  expect(on.sources).toEqual([]);
});

test("plan-keeper enable adds the shell source, disable removes it", () => {
  expect(isPlanKeeperEnabled(base)).toBe(false);
  const on = setPlanKeeperEnabled(base, true);
  expect(isPlanKeeperEnabled(on)).toBe(true);
  expect(on.sources).toEqual([planKeeperSource()]);
  const off = setPlanKeeperEnabled(on, false);
  expect(isPlanKeeperEnabled(off)).toBe(false);
  expect(off.sources).toEqual([]);
});

test("planKeeperSource uses the bare plan-keeper command", () => {
  const s = planKeeperSource() as {
    name: string;
    commands: Record<string, string>;
  };
  expect(s.name).toBe("plans");
  expect(s.commands.fetch).toBe("plan-keeper crew fetch");
  expect(s.commands.resolveOne).toBe("plan-keeper crew get ${id}");
});

test("customSourceCount ignores linear and plan-keeper entries", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear", enabled: false },
      { kind: "shell", name: "plans" },
      { kind: "shell", name: "jira" },
    ],
  } as never;
  expect(customSourceCount(draft)).toBe(1);
});
