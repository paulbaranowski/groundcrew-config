import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import type { FieldSpec } from "../domain/sections.ts";
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

test("renders fields and the focused field's help", () => {
  const { lastFrame } = render(
    <SectionForm
      title="Git"
      spec={spec}
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("remote");
  expect(lastFrame()).toContain("Git remote name.");
});

test("typing into the active text field emits an updated draft", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SectionForm
      title="Git"
      spec={spec}
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
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
      spec={numberSpec}
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
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
      spec={spec}
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
      onChange={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write(""); // escape
  // ink buffers a lone ESC briefly to disambiguate it from escape sequences
  // (arrows etc.), so let the event loop tick before asserting.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onBack).toHaveBeenCalled();
});
