import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ShellEnvEditor } from "./ShellEnvEditor.tsx";
import type { EnvEntry } from "../domain/sources.ts";

const ESC = String.fromCharCode(27);
const DOWN = `${ESC}[B`;

test("lists existing variables as key = value", () => {
  const env: EnvEntry[] = [{ key: "JIRA_HOST", value: "jira.example.com" }];
  const { lastFrame } = render(
    <ShellEnvEditor env={env} onChange={() => {}} onBack={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Environment variables");
  expect(f).toContain("JIRA_HOST");
  expect(f).toContain("jira.example.com");
});

test("esc on the list goes back", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <ShellEnvEditor env={[]} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("adding a variable appends a new key/value entry", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <ShellEnvEditor env={[]} onChange={onChange} onBack={() => {}} />,
  );
  // Cursor starts on the "+ add variable…" row; enter opens the entry editor.
  // Await a re-render between keystrokes: each TextField's focus is state-driven,
  // so a burst would type into the stale-active field before React re-renders.
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("Environment variable"));
  // Let the freshly-mounted TextField's useInput effect subscribe before typing,
  // otherwise the first keystroke lands before stdin is wired up and is dropped.
  await new Promise((resolve) => setTimeout(resolve, 20));
  stdin.write("JIRA_TOKEN"); // key field is active first
  await vi.waitFor(() => expect(lastFrame()).toContain("JIRA_TOKEN"));
  stdin.write(DOWN); // move focus to the value field
  await vi.waitFor(() => expect(lastFrame()).toContain("› value"));
  stdin.write("secret");
  await vi.waitFor(() => expect(lastFrame()).toContain("secret"));
  stdin.write("\r"); // save the entry
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith([
      { key: "JIRA_TOKEN", value: "secret" },
    ]),
  );
});

test("d deletes the focused variable", async () => {
  const onChange = vi.fn();
  const env: EnvEntry[] = [
    { key: "A", value: "1" },
    { key: "B", value: "2" },
  ];
  const { stdin } = render(
    <ShellEnvEditor env={env} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write("d"); // cursor on the first entry
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith([{ key: "B", value: "2" }]),
  );
});
