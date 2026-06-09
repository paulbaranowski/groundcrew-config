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
