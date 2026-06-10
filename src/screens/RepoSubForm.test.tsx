import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { RepoSubForm } from "./RepoSubForm.tsx";

test("previews resolved location using projectDir default", () => {
  const { lastFrame } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev/groundcrew"
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("Repo located at: ~/dev/groundcrew/org/repo");
});

test("enter saves the current entry", () => {
  const onSave = vi.fn();
  const { stdin } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev/groundcrew"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    name: "org/repo",
    projectDirOverride: undefined,
    workdir: undefined,
    provision: undefined,
  });
});

test("enter preserves an existing workdir and provision unchanged", () => {
  const onSave = vi.fn();
  const { stdin } = render(
    <RepoSubForm
      entry={{
        name: "org/repo",
        projectDirOverride: undefined,
        workdir: "service",
        provision: { create: "graft add", remove: "graft rm" },
      }}
      projectDir="~/dev/groundcrew"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    name: "org/repo",
    projectDirOverride: undefined,
    workdir: "service",
    provision: { create: "graft add", remove: "graft rm" },
  });
});
