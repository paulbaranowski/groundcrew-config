import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { WorkspaceForm } from "./WorkspaceForm.tsx";

const draft = {
  workspace: {
    projectDir: "~/dev/groundcrew",
    knownRepositories: ["a/b", "a/b"],
  },
} as never;

test("renders fields and flags the duplicate repo", () => {
  const { lastFrame } = render(
    <WorkspaceForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("projectDir");
  expect(lastFrame()).toContain("worktreeDir");
  expect(lastFrame()).toContain("a/b");
  expect(lastFrame()).toContain("duplicate");
});
