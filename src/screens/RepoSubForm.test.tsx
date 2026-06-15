import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { RepoSubForm } from "./RepoSubForm.tsx";
import type { RepoEntry } from "../domain/repoEntries.ts";

const ESC = String.fromCharCode(27);
const DOWN = "\x1b[B"; // down-arrow escape sequence

test("previews resolved location using projectDir default", () => {
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const { lastFrame } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
      projectDir="~/dev/groundcrew"
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("Repo located at: ~/dev/groundcrew/org/repo");
});

test("enter saves the current entry", () => {
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const onSave = vi.fn();
  const { stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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
  const entry: RepoEntry = {
    name: "org/repo",
    projectDirOverride: undefined,
    workdir: "service",
    provision: { create: "graft add", remove: "graft rm" },
  };
  const onSave = vi.fn();
  const { stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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

test("projectDirOverride is inert while provision is set", async () => {
  const entry: RepoEntry = {
    name: "org/repo",
    projectDirOverride: undefined,
    provision: { create: "graft add", remove: "graft rm" },
  };
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
      projectDir="~/dev"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  // The override field reads as disabled rather than offering its placeholder.
  expect(lastFrame()).toContain("projectDirOverride");
  expect(lastFrame()).toContain("disabled");
  stdin.write(DOWN); // focus projectDirOverride
  await vi.waitFor(() => expect(lastFrame()).toContain("› projectDirOverride"));
  stdin.write("X"); // inert: typing is ignored
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    name: "org/repo",
    projectDirOverride: undefined,
    workdir: undefined,
    provision: { create: "graft add", remove: "graft rm" },
  });
});

test("provision fields are inert while projectDirOverride is set", async () => {
  const entry: RepoEntry = {
    name: "org/repo",
    projectDirOverride: "~/custom",
  };
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
      projectDir="~/dev"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write(DOWN); // name -> projectDirOverride
  stdin.write(DOWN); // -> workdir
  stdin.write(DOWN); // -> provision.create
  await vi.waitFor(() => expect(lastFrame()).toContain("› provision.create"));
  stdin.write("X"); // inert
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    name: "org/repo",
    projectDirOverride: "~/custom",
    workdir: undefined,
    provision: undefined,
  });
});

test("a legacy entry with both set keeps both fields editable", async () => {
  const entry: RepoEntry = {
    name: "org/repo",
    projectDirOverride: "~/custom",
    provision: { create: "graft add", remove: "graft rm" },
  };
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
      projectDir="~/dev"
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  stdin.write(DOWN); // focus projectDirOverride
  await vi.waitFor(() => expect(lastFrame()).toContain("› projectDirOverride"));
  stdin.write("Z"); // editable: neither field is disabled while both are set
  await vi.waitFor(() => expect(lastFrame()).toContain("~/customZ"));
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({
    name: "org/repo",
    projectDirOverride: "~/customZ",
    workdir: undefined,
    provision: { create: "graft add", remove: "graft rm" },
  });
});

test("the save guard's esc returns to editing", async () => {
  const entry: RepoEntry = { name: "org/repo", projectDirOverride: undefined };
  const onCancel = vi.fn();
  const { lastFrame, stdin } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={entry}
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

test("marks a field that differs from baseline with ●", () => {
  const baselineEntry: RepoEntry = {
    name: "a",
    projectDirOverride: undefined,
  };
  const entry: RepoEntry = { name: "a", projectDirOverride: "/elsewhere" };
  const { lastFrame } = render(
    <RepoSubForm
      entry={entry}
      baselineEntry={baselineEntry}
      projectDir="/projects"
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("projectDirOverride")) ?? "";
  expect(line).toContain("●");
  const nameLine =
    (lastFrame() ?? "").split("\n").find((l) => l.match(/\sname\s/)) ?? "";
  expect(nameLine).not.toContain("●");
});
