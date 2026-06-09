import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { ModelsForm } from "./ModelsForm.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
  models: { default: "claude", definitions: { claude: {} } },
} as never;

test("shows the claude bypass checkbox unchecked by default", () => {
  const { lastFrame } = render(
    <ModelsForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("claude");
  expect(lastFrame()).toContain("bypass permission prompts");
  expect(lastFrame()).toContain("[ ]");
});

test("shows the checkbox checked when claude already bypasses", () => {
  const on = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    models: {
      default: "claude",
      definitions: { claude: { cmd: "claude --permission-mode bypassPermissions" } },
    },
  } as never;
  const { lastFrame } = render(
    <ModelsForm draft={on} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("[x]");
});

test("space toggles bypass on the focused claude model", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <ModelsForm draft={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      models: expect.objectContaining({
        definitions: {
          claude: { cmd: "claude --permission-mode bypassPermissions" },
        },
      }),
    }),
  );
});

test("non-claude models are shown read-only for raw JSON editing", () => {
  const mixed = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    models: {
      default: "claude",
      definitions: {
        claude: {},
        codex: { cmd: "codex --dangerously-bypass-approvals-and-sandbox" },
      },
    },
  } as never;
  const { lastFrame } = render(
    <ModelsForm draft={mixed} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("codex");
  expect(lastFrame()).toContain("raw JSON");
});

test("notes when there are no claude models to toggle", () => {
  const empty = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    models: { default: "codex", definitions: { codex: { cmd: "codex" } } },
  } as never;
  const { lastFrame } = render(
    <ModelsForm draft={empty} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("no claude");
});

test("esc returns to the home screen", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <ModelsForm draft={draft} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(""); // escape
  // ink buffers a lone ESC briefly to disambiguate it from escape sequences
  // (arrows etc.), so wait for the handler rather than asserting synchronously.
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
