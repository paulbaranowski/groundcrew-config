import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ShellSourceSubForm } from "./ShellSourceSubForm.tsx";

const ESC = String.fromCharCode(27);
const DOWN = `${ESC}[B`;

test("seeds fields from an existing source and lists the lifecycle commands", () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
  } as never;
  const { lastFrame } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
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
    <ShellSourceSubForm
      source={undefined}
      baselineSource={undefined}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("name is required");
  expect(f).toContain("commands.listTasks is required");
});

test("enter saves the built shell source", async () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
  } as never;
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
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
    <ShellSourceSubForm
      source={undefined}
      baselineSource={undefined}
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});

test("shows the env variable count from the source", () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    env: { JIRA_TOKEN: "secret" },
  } as never;
  const { lastFrame } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("env");
  expect(lastFrame()).toContain("1 variable");
});

test("save round-trips an existing env untouched", () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    env: { JIRA_TOKEN: "secret" },
  } as never;
  const onSave = vi.fn();
  const { stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write("\r"); // enter on the name row saves
  expect(onSave).toHaveBeenCalledWith({
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    env: { JIRA_TOKEN: "secret" },
  });
});

test("esc after an edit pops the save guard", async () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
  } as never;
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write("2"); // edit the name field
  await vi.waitFor(() => expect(lastFrame()).toContain("jira2"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Save these edits to current draft config"));
  expect(onCancel).not.toHaveBeenCalled();
});

test("entering the env row opens the env editor", async () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
  } as never;
  const { lastFrame, stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  // 10 text rows precede the env row; step down to it, then enter.
  for (let i = 0; i < 10; i++) stdin.write(DOWN);
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("Environment variables"));
});

test("shows the sandboxWritePaths count from the source", () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    sandboxWritePaths: ["~/.cache/jira"],
  } as never;
  const { lastFrame } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("sandboxWritePaths");
  expect(f).toContain("1 path");
});

test("save round-trips an existing sandboxWritePaths untouched", () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    sandboxWritePaths: ["~/.cache/jira", "/tmp/jira"],
  } as never;
  const onSave = vi.fn();
  const { stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write("\r"); // enter on the name row saves
  expect(onSave).toHaveBeenCalledWith({
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
    sandboxWritePaths: ["~/.cache/jira", "/tmp/jira"],
  });
});

test("entering the sandboxWritePaths row opens the paths editor", async () => {
  const source = {
    kind: "shell",
    name: "jira",
    commands: { listTasks: "jira ls" },
  } as never;
  const { lastFrame, stdin } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={source}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  // 10 text rows + env row precede sandboxWritePaths; step down to it, then enter.
  for (let i = 0; i < 11; i++) stdin.write(DOWN);
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("Sandbox write paths"));
});

test("marks a field whose buffered value differs from baseline with ●", () => {
  const baseSource = {
    kind: "shell" as const,
    name: "jira",
    commands: { listTasks: "old-cmd" },
  };
  const source = {
    kind: "shell" as const,
    name: "jira",
    commands: { listTasks: "new-cmd" },
  };
  const { lastFrame } = render(
    <ShellSourceSubForm
      source={source}
      baselineSource={baseSource}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("commands.listTasks")) ?? "";
  expect(line).toContain("●");
});
