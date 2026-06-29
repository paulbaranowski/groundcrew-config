import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ShellSourcesForm } from "./ShellSourcesForm.tsx";

const ESC = String.fromCharCode(27);

function draftWith(sources: unknown[]) {
  return {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources,
  } as never;
}

test("lists generic shell sources, excluding plankeeper", () => {
  const { lastFrame } = render(
    <ShellSourcesForm
      draft={draftWith([
        { kind: "shell", name: "plankeeper" },
        { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      ])}
      baseline={draftWith([
        { kind: "shell", name: "plankeeper" },
        { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      ])}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("jira");
  expect(f).not.toContain("plankeeper");
  expect(f).toContain("+ add shell source…");
});

test("enter on the add row opens a blank builder", async () => {
  const { lastFrame, stdin } = render(
    <ShellSourcesForm draft={draftWith([])} baseline={draftWith([])} onChange={() => {}} onBack={() => {}} />,
  );
  stdin.write("\r"); // add row is the only row
  // "commands.listTasks" only exists on the builder, not the list.
  await vi.waitFor(() => expect(lastFrame()).toContain("commands.listTasks"));
  expect(lastFrame()).toContain("name is required");
});

test("deleting a shell source commits the removal", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <ShellSourcesForm
      draft={draftWith([
        { kind: "linear" },
        { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      ])}
      baseline={draftWith([
        { kind: "linear" },
        { kind: "shell", name: "jira", commands: { listTasks: "jira ls" } },
      ])}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("d"); // delete the focused (first) shell entry
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "linear" }] }),
  );
});

test("esc returns to the hub", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <ShellSourcesForm draft={draftWith([])} baseline={draftWith([])} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("marks a changed shell source row with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [
      { kind: "shell" as const, name: "jira", commands: { listTasks: "old" } },
    ],
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [
      { kind: "shell" as const, name: "jira", commands: { listTasks: "new" } },
    ],
  } as never;
  const { lastFrame } = render(
    <ShellSourcesForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("jira")) ?? "";
  expect(line).toContain("●");
});
