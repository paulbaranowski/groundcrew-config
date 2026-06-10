import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { TodoTxtForm } from "./TodoTxtForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled and enables on space", () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <TodoTxtForm draft={base} onChange={onChange} onBack={() => {}} />,
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
    <TodoTxtForm draft={draft} onChange={() => {}} onBack={() => {}} />,
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
    <TodoTxtForm draft={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write("x");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      sources: [{ kind: "todo-txt", todoPath: "x" }],
    }),
  );
});
