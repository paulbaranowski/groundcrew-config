import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { simpleSectionSpec, type FieldSpec } from "../domain/sections.ts";
import { SectionForm } from "./SectionForm.tsx";

const spec: FieldSpec[] = [
  {
    path: "git.remote",
    label: "remote",
    kind: "text",
    help: "Git remote name.",
    placeholder: "origin",
  },
  {
    path: "local.runner",
    label: "runner",
    kind: "select",
    options: ["auto", "sdx"],
    help: "Sandbox backend.",
  },
];

const emptyDraft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
} as never;

test("renders fields and the focused field's help", () => {
  const { lastFrame } = render(
    <SectionForm
      title="Git"
      description="What this section is for."
      spec={spec}
      draft={emptyDraft}
      baseline={emptyDraft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("remote");
  expect(lastFrame()).toContain("Git remote name.");
  expect(lastFrame()).toContain("What this section is for.");
});

test("typing into the active text field emits an updated draft", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SectionForm
      title="Git"
      description="What this section is for."
      spec={spec}
      draft={emptyDraft}
      baseline={emptyDraft}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("u");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ git: { remote: "u" } }),
  );
});

test("a non-numeric value in a number field does not emit NaN", () => {
  const onChange = vi.fn();
  const numberSpec: FieldSpec[] = [
    {
      path: "orchestrator.maximumInProgress",
      label: "maximumInProgress",
      kind: "number",
      help: "Max in progress.",
    },
  ];
  const { stdin } = render(
    <SectionForm
      title="Orchestrator"
      description="What this section is for."
      spec={numberSpec}
      draft={emptyDraft}
      baseline={emptyDraft}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write("x"); // not a digit
  expect(onChange).not.toHaveBeenCalled();
});

test("esc calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <SectionForm
      title="Git"
      description="What this section is for."
      spec={spec}
      draft={emptyDraft}
      baseline={emptyDraft}
      onChange={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write("\x1b"); // escape
  // ink buffers a lone ESC briefly to disambiguate it from escape sequences
  // (arrows etc.), so wait for the handler rather than asserting synchronously.
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("marks a changed scalar field with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    git: { remote: "origin", defaultBranch: "main" },
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    git: { remote: "origin", defaultBranch: "dev" },
  } as never;
  const { lastFrame } = render(
    <SectionForm
      title="Git"
      description="Git settings"
      spec={simpleSectionSpec("git")}
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  const branchLine =
    frame.split("\n").find((l) => l.includes("defaultBranch")) ?? "";
  expect(branchLine).toContain("●");
  const remoteLine = frame.split("\n").find((l) => l.includes("remote")) ?? "";
  expect(remoteLine).not.toContain("●");
});
