import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { App } from "./app.tsx";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
  models: { default: "claude", definitions: { claude: {} } },
} as never;

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 20));

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
  await tick();
  expect(lastFrame()).toContain("knownRepositories");
  stdin.write(""); // esc back
  await tick();
  expect(lastFrame()).toContain("Ticket Sources");
  unmount();
});
