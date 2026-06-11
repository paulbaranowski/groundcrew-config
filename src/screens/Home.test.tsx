import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { Home } from "./Home.tsx";

const DOWN = "\x1b[B"; // down-arrow escape sequence

const draft = {
  workspace: {
    projectDir: "~/dev/groundcrew",
    knownRepositories: ["a/b", "c/d"],
  },
  agents: { default: "claude", definitions: { claude: {} } },
} as never;

test("renders sections with summaries and a warning badge", () => {
  const { lastFrame } = render(
    <Home
      draft={draft}
      issues={new Set(["sandbox"])}
      cursor={0}
      onCursorChange={() => {}}
      onOpen={() => {}}
    />,
  );
  expect(lastFrame()).toContain("Workspace");
  expect(lastFrame()).toContain("~/dev/groundcrew");
  expect(lastFrame()).toContain("Repositories");
  expect(lastFrame()).toContain("2 repos");
  expect(lastFrame()).toContain("Task Sources");
  expect(lastFrame()).toContain("⚠");
});

test("enter opens the focused section", () => {
  const onOpen = vi.fn();
  const { stdin } = render(
    <Home
      draft={draft}
      issues={new Set()}
      cursor={0}
      onCursorChange={() => {}}
      onOpen={onOpen}
    />,
  );
  stdin.write("\r");
  expect(onOpen).toHaveBeenCalledWith("repositories");
});

test("reports cursor moves to the parent", () => {
  const onCursorChange = vi.fn();
  const { stdin } = render(
    <Home
      draft={draft}
      issues={new Set()}
      cursor={0}
      onCursorChange={onCursorChange}
      onOpen={() => {}}
    />,
  );
  stdin.write(DOWN);
  expect(onCursorChange).toHaveBeenCalledWith(1);
});
