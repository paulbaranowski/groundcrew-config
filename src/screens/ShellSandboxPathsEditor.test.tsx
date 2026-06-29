import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ShellSandboxPathsEditor } from "./ShellSandboxPathsEditor.tsx";

const ESC = String.fromCharCode(27);

test("lists existing sandbox paths", () => {
  const paths = ["~/.cache/jira", "/tmp/jira"];
  const { lastFrame } = render(
    <ShellSandboxPathsEditor
      paths={paths}
      baselinePaths={paths}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Sandbox write paths");
  expect(f).toContain("~/.cache/jira");
  expect(f).toContain("/tmp/jira");
});

test("esc on the list goes back", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <ShellSandboxPathsEditor
      paths={[]}
      baselinePaths={[]}
      onChange={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("adding a path appends a new entry", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellSandboxPathsEditor
      paths={[]}
      baselinePaths={[]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  // Cursor starts on the "+ add path…" row; enter opens the entry editor.
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("Sandbox write path"));
  // Let the freshly-mounted TextField's useInput effect subscribe before typing,
  // otherwise the first keystroke lands before stdin is wired up and is dropped.
  await new Promise((resolve) => setTimeout(resolve, 20));
  stdin.write("~/.cache/jira");
  await vi.waitFor(() => expect(lastFrame()).toContain("~/.cache/jira"));
  stdin.write("\r"); // save the entry
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(["~/.cache/jira"]),
  );
});

test("d deletes the focused path", async () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <ShellSandboxPathsEditor
      paths={["a", "b"]}
      baselinePaths={["a", "b"]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("d"); // cursor on the first entry
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(["b"]));
});

test("marks a changed path row with ●", () => {
  const { lastFrame } = render(
    <ShellSandboxPathsEditor
      paths={["~/.cache/new"]}
      baselinePaths={["~/.cache/old"]}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("~/.cache/new")) ?? "";
  expect(line).toContain("●");
});

test("Enter on a blank path does not commit and keeps the editor open", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellSandboxPathsEditor
      paths={[]}
      baselinePaths={[]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("\r"); // open editor on "+ add path…"
  await vi.waitFor(() => expect(lastFrame()).toContain("Sandbox write path"));
  await new Promise((r) => setTimeout(r, 20)); // let TextField subscribe
  stdin.write("\r"); // Enter on blank
  // Editor still open, warning visible, parent never notified.
  expect(lastFrame()).toContain("Sandbox write path");
  expect(lastFrame()).toContain("path is required");
  expect(onChange).not.toHaveBeenCalled();
});
