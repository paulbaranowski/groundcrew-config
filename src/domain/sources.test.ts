import { expect, test } from "vitest";
import {
  customSourceCount,
  enabledSourceCount,
  getTodoTxtField,
  isLinearEnabled,
  isPlanKeeperEnabled,
  isTodoTxtEnabled,
  planKeeperSource,
  setLinearEnabled,
  setPlanKeeperEnabled,
  setTodoTxtEnabled,
  setTodoTxtField,
  todoTxtSource,
} from "./sources.ts";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("linear is off by default; enable adds {kind:linear}; disable removes it", () => {
  expect(isLinearEnabled(base)).toBe(false);
  const on = setLinearEnabled(base, true);
  expect(on.sources).toEqual([{ kind: "linear" }]);
  expect(isLinearEnabled(on)).toBe(true);
  const off = setLinearEnabled(on, false);
  expect(off.sources).toEqual([]);
  expect(isLinearEnabled(off)).toBe(false);
});

test("a loaded {kind:linear,enabled:false} reads as disabled", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear", enabled: false }],
  } as never;
  expect(isLinearEnabled(draft)).toBe(false);
});

test("todo-txt enable adds {kind:todo-txt}; disable removes it", () => {
  expect(isTodoTxtEnabled(base)).toBe(false);
  const on = setTodoTxtEnabled(base, true);
  expect(on.sources).toEqual([todoTxtSource()]);
  expect(isTodoTxtEnabled(on)).toBe(true);
  const off = setTodoTxtEnabled(on, false);
  expect(off.sources).toEqual([]);
});

test("todo-txt field get/set on the todo-txt entry", () => {
  let draft = setTodoTxtEnabled(base, true);
  draft = setTodoTxtField(draft, "todoPath", "~/todo.txt");
  expect(getTodoTxtField(draft, "todoPath")).toBe("~/todo.txt");
  draft = setTodoTxtField(draft, "todoPath", "");
  expect(getTodoTxtField(draft, "todoPath")).toBeUndefined();
});

test("enabledSourceCount counts non-disabled entries", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "todo-txt" },
      { kind: "shell", name: "x", enabled: false },
    ],
  } as never;
  expect(enabledSourceCount(draft)).toBe(2);
  expect(enabledSourceCount(base)).toBe(0);
});

test("customSourceCount excludes linear, plan-keeper, and todo-txt", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      { kind: "linear" },
      { kind: "todo-txt" },
      { kind: "shell", name: "plans" },
      { kind: "shell", name: "jira" },
    ],
  } as never;
  expect(customSourceCount(draft)).toBe(1);
});

test("planKeeperSource unchanged", () => {
  const s = planKeeperSource() as {
    name: string;
    commands: Record<string, string>;
  };
  expect(s.name).toBe("plans");
  expect(s.commands.fetch).toBe("plan-keeper crew fetch");
});

test("isPlanKeeperEnabled / setPlanKeeperEnabled round-trip", () => {
  expect(isPlanKeeperEnabled(base)).toBe(false);
  const on = setPlanKeeperEnabled(base, true);
  expect(isPlanKeeperEnabled(on)).toBe(true);
  expect(setPlanKeeperEnabled(on, false).sources).toEqual([]);
});
