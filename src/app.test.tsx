import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { App } from "./app.tsx";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
  models: { default: "claude", definitions: { claude: {} } },
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
  stdin.write("\r"); // open Workspace
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  stdin.write(""); // esc back
  await vi.waitFor(() => expect(lastFrame()).toContain("Task Sources"));
  unmount();
});

test("opens the Models bypass-permissions form from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  // Each waitFor yields a tick so ink processes one queued arrow before the
  // next write. [B is the down-arrow escape sequence.
  stdin.write("[B"); // down to Repositories (row 2)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write("[B"); // down to Models (row 3)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Models"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("bypass permission prompts"),
  );
  unmount();
});

test("opens Repositories from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write("[B"); // down to Repositories (row 2)
  await vi.waitFor(() => expect(lastFrame()).toContain("Repositories"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("owner/repo names groundcrew"),
  );
  unmount();
});
