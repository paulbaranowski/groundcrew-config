import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { App } from "./app.tsx";

const DOWN = "\x1b[B"; // down-arrow escape sequence
const ESC = "\x1b";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
  agents: { default: "claude", definitions: { claude: {} } },
} as never;

test("starts on Home when given an existing draft", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("Workspace");
  expect(lastFrame()).toContain("q quit");
  unmount();
});

test("starts on Home with no existing config", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={undefined} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("crew-config");
  expect(lastFrame()).toContain("Workspace");
  unmount();
});

test("shows the no-task-sources warning on Home", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("no task sources");
  unmount();
});

test("enter opens a section, esc returns home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write("\r"); // open Repositories (row 0)
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("repos groundcrew is allowed to work on"),
  );
  stdin.write(ESC); // esc back
  await vi.waitFor(() => expect(lastFrame()).toContain("Task Sources"));
  unmount();
});

test("opens the Agents bypass-permissions form from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  // Each waitFor yields a tick so ink processes one queued arrow before the
  // next write. Agents is row 3: Repositories, Workspace, Task Sources, Agents.
  stdin.write(DOWN); // down to Workspace (row 1)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write(DOWN); // down to Task Sources (row 2)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Task Sources"));
  stdin.write(DOWN); // down to Agents (row 3)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Agents"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("bypass permission prompts"),
  );
  unmount();
});

test("esc restores the Home row that was open", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN); // down to Workspace (row 1)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write("\r"); // open Workspace
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  stdin.write(ESC); // esc back to Home
  // The cursor must stay on Workspace, not snap back to Repositories.
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  expect(lastFrame()).not.toContain("▸ Repositories");
  unmount();
});

test("opens Repositories from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write("\r"); // open Repositories (row 0)
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("repos groundcrew is allowed to work on"),
  );
  unmount();
});
