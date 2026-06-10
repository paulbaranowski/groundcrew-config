import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TaskSourcesMenu } from "./TaskSourcesMenu.tsx";

const draft = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;
const ESC = "";

test("lists Linear, todo-txt, PlanKeeper and Custom", () => {
  const { lastFrame } = render(
    <TaskSourcesMenu draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Task Sources");
  expect(lastFrame()).toContain("Linear");
  expect(lastFrame()).toContain("todo-txt");
  expect(lastFrame()).toContain("PlanKeeper");
  expect(lastFrame()).toContain("Custom");
});

test("lists the Shell sources row with its source count", () => {
  const draftWithShell = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "shell", name: "jira", commands: { listTasks: "jira ls" } }],
  } as never;
  const { lastFrame } = render(
    <TaskSourcesMenu draft={draftWithShell} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Shell sources");
  expect(lastFrame()).toContain("1 source(s)");
});

test("enter opens todo-txt; esc returns to the hub", async () => {
  const { lastFrame, stdin } = render(
    <TaskSourcesMenu draft={draft} onChange={() => {}} onBack={() => {}} />,
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
    <TaskSourcesMenu draft={draft} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
