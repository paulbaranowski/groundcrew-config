import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { RepoSubForm } from "./RepoSubForm.tsx";

const ESC = String.fromCharCode(27);

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

test("esc with no edits cancels immediately, no guard", async () => {
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev"
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  expect(lastFrame()).not.toContain("Unsaved repository");
});

test("esc after an edit pops the save guard, and 's' commits the edit", async () => {
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write("X"); // edits the name field (active first)
  await vi.waitFor(() => expect(lastFrame()).toContain("org/repoX"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Unsaved repository"));
  stdin.write("s");
  await vi.waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({
      name: "org/repoX",
      projectDirOverride: undefined,
      workdir: undefined,
      provision: undefined,
    }),
  );
});

test("the save guard's discard cancels without saving", async () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev"
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  stdin.write("X");
  await vi.waitFor(() => expect(lastFrame()).toContain("org/repoX"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Unsaved repository"));
  stdin.write("d");
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  expect(onSave).not.toHaveBeenCalled();
});

test("the save guard's esc returns to editing", async () => {
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={{ name: "org/repo", projectDirOverride: undefined }}
      projectDir="~/dev"
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write("X");
  await vi.waitFor(() => expect(lastFrame()).toContain("org/repoX"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Unsaved repository"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Repo located at"));
  expect(onCancel).not.toHaveBeenCalled();
});
