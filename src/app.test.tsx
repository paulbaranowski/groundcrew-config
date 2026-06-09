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

test("starts on the Wizard when no draft exists", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={undefined} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("first-run setup");
  unmount();
});

test("enter opens a section, esc returns home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write("\r"); // open Workspace
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  stdin.write(""); // esc back
  await vi.waitFor(() => expect(lastFrame()).toContain("Ticket Sources"));
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
