import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ShellSourceSubForm } from "./ShellSourceSubForm.tsx";

const ESC = String.fromCharCode(27);

test("seeds fields from an existing source and lists the lifecycle commands", () => {
  const { lastFrame } = render(
    <ShellSourceSubForm
      source={{ kind: "shell", name: "jira", commands: { listTasks: "jira ls" } } as never}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Shell source");
  expect(f).toContain("commands.listTasks");
  expect(f).toContain("commands.markInProgress");
  expect(f).toContain("jira ls");
  expect(f).toContain("jira"); // name field
});

test("warns when name or listTasks is missing", () => {
  const { lastFrame } = render(
    <ShellSourceSubForm source={undefined} onSave={() => {}} onCancel={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("name is required");
  expect(f).toContain("commands.listTasks is required");
});

test("enter saves the built shell source", async () => {
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellSourceSubForm
      source={{ kind: "shell", name: "jira", commands: { listTasks: "jira ls" } } as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  // Append to the name field, wait for the re-render, then save.
  stdin.write("2");
  await vi.waitFor(() => expect(lastFrame()).toContain("jira2"));
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    kind: "shell",
    name: "jira2",
    commands: { listTasks: "jira ls" },
  });
});

test("esc cancels", async () => {
  const onCancel = vi.fn();
  const { stdin } = render(
    <ShellSourceSubForm source={undefined} onSave={() => {}} onCancel={onCancel} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});
