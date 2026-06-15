import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { WorkspaceForm } from "./WorkspaceForm.tsx";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: [] },
} as never;

test("renders projectDir and worktreeDir, not the repo list", () => {
  const { lastFrame } = render(
    <WorkspaceForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("projectDir");
  expect(lastFrame()).toContain("worktreeDir");
  expect(lastFrame()).not.toContain("knownRepositories");
});

test("marks a changed projectDir with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never;
  const next = {
    workspace: { projectDir: "~/code", knownRepositories: [] },
  } as never;
  const { lastFrame } = render(
    <WorkspaceForm
      draft={next}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  const line = frame.split("\n").find((l) => l.includes("projectDir")) ?? "";
  expect(line).toContain("●");
});
