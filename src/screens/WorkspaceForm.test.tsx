import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { WorkspaceForm } from "./WorkspaceForm.tsx";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: [] },
} as never;

test("renders projectDir and worktreeDir, not the repo list", () => {
  const { lastFrame } = render(
    <WorkspaceForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("projectDir");
  expect(lastFrame()).toContain("worktreeDir");
  expect(lastFrame()).not.toContain("knownRepositories");
});
