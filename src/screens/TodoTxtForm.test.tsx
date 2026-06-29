import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TodoTxtForm } from "./TodoTxtForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled and enables on space", () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <TodoTxtForm draft={base} baseline={base} onChange={onChange} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("disabled");
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "todo-txt" }] }),
  );
});

test("shows all editable fields when enabled", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "todo-txt" }],
  } as never;
  const { lastFrame } = render(
    <TodoTxtForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("todoPath");
  expect(f).toContain("tasksDir");
  expect(f).toContain("defaultRepository");
  expect(f).toContain("idPrefix");
  expect(f).toContain("timezone");
});

test("typing into todoPath writes the field on the todo-txt entry", () => {
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "todo-txt" }],
  } as never;
  const { stdin } = render(
    <TodoTxtForm draft={draft} baseline={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write("x");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      sources: [{ kind: "todo-txt", todoPath: "x" }],
    }),
  );
});

test("marks a changed todoPath with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "todo-txt" as const }],
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "todo-txt" as const, todoPath: "~/notes/todo.txt" }],
  } as never;
  const { lastFrame } = render(
    <TodoTxtForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("todoPath")) ?? "";
  expect(line).toContain("●");
});

test("marks the enable toggle with ● when enabled-ness changed", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "todo-txt" as const }],
  } as never;
  const { lastFrame } = render(
    <TodoTxtForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("todo-txt source")) ??
    "";
  expect(line).toContain("●");
});
