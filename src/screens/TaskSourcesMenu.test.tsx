import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TaskSourcesMenu } from "./TaskSourcesMenu.tsx";

const draft = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;
const ESC = "";

test("lists Linear, todo-txt, PlanKeeper and Shell sources", () => {
  const { lastFrame } = render(
    <TaskSourcesMenu draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Task Sources");
  expect(lastFrame()).toContain("Linear");
  expect(lastFrame()).toContain("todo-txt");
  expect(lastFrame()).toContain("PlanKeeper");
  expect(lastFrame()).toContain("Shell sources");
  expect(lastFrame()).not.toContain("Custom");
});

test("lists the Shell sources row with its source count", () => {
  const draftWithShell = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "shell", name: "jira", commands: { listTasks: "jira ls" } }],
  } as never;
  const { lastFrame } = render(
    <TaskSourcesMenu draft={draftWithShell} baseline={draftWithShell} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Shell sources");
  expect(lastFrame()).toContain("1 source(s)");
});

test("enter opens todo-txt; esc returns to the hub", async () => {
  const { lastFrame, stdin } = render(
    <TaskSourcesMenu draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  stdin.write("[B"); // down to todo-txt (row 2)
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("todo-txt source:"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("PlanKeeper"));
});

test("esc on the hub calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <TaskSourcesMenu draft={draft} baseline={draft} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("shows the ● marker on rows whose source slice differs from baseline", () => {
  // Baseline has Linear off; draft has it on. Only the Linear row should
  // carry the ● — todo-txt / PlanKeeper / Shell are unchanged.
  const draftWithLinear = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear" }],
  } as never;
  const { lastFrame } = render(
    <TaskSourcesMenu
      draft={draftWithLinear}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  const linearLine = frame.split("\n").find((l) => l.includes("Linear")) ?? "";
  expect(linearLine).toContain("●");
  const todoLine = frame.split("\n").find((l) => l.includes("todo-txt")) ?? "";
  expect(todoLine).not.toContain("●");
});
