import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { PreLaunchEnvEditor } from "./PreLaunchEnvEditor.tsx";

const ESC = String.fromCharCode(27);

test("lists existing env names", () => {
  const names = ["GITHUB_TOKEN", "JIRA_API_TOKEN"];
  const { lastFrame } = render(
    <PreLaunchEnvEditor
      names={names}
      baselineNames={names}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("preLaunchEnv");
  expect(f).toContain("GITHUB_TOKEN");
  expect(f).toContain("JIRA_API_TOKEN");
});

test("esc on the list goes back", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <PreLaunchEnvEditor
      names={[]}
      baselineNames={[]}
      onChange={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("adding a name appends a new entry", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <PreLaunchEnvEditor
      names={[]}
      baselineNames={[]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  // Cursor starts on the "+ add env name…" row; enter opens the entry editor.
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("preLaunchEnv name"));
  // Let the freshly-mounted TextField's useInput effect subscribe before typing,
  // otherwise the first keystroke lands before stdin is wired up and is dropped.
  await new Promise((resolve) => setTimeout(resolve, 20));
  // Use a value absent from the placeholder ("…e.g. GITHUB_TOKEN") so the
  // waitFor genuinely blocks on the typed value rendering, not the placeholder.
  stdin.write("MY_SECRET");
  await vi.waitFor(() => expect(lastFrame()).toContain("MY_SECRET"));
  stdin.write("\r"); // save the entry
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(["MY_SECRET"]),
  );
});

test("d deletes the focused name", async () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <PreLaunchEnvEditor
      names={["A", "B"]}
      baselineNames={["A", "B"]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("d"); // cursor on the first entry
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(["B"]));
});

test("marks a changed name row with ●", () => {
  const { lastFrame } = render(
    <PreLaunchEnvEditor
      names={["NEW_TOKEN"]}
      baselineNames={["OLD_TOKEN"]}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("NEW_TOKEN")) ?? "";
  expect(line).toContain("●");
});

test("Enter on a blank name does not commit and keeps the editor open", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <PreLaunchEnvEditor
      names={[]}
      baselineNames={[]}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("\r"); // open editor on "+ add env name…"
  await vi.waitFor(() => expect(lastFrame()).toContain("preLaunchEnv name"));
  await new Promise((r) => setTimeout(r, 20)); // let TextField subscribe
  stdin.write("\r"); // Enter on blank
  // Editor still open, warning visible, parent never notified.
  expect(lastFrame()).toContain("preLaunchEnv name");
  expect(lastFrame()).toContain("name is required");
  expect(onChange).not.toHaveBeenCalled();
});
