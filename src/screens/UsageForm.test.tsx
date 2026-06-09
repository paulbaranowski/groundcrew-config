import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { UsageForm } from "./UsageForm.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
  models: { default: "claude", definitions: { claude: {} } },
} as never;

test("shows tracking enabled by default", () => {
  const { lastFrame } = render(
    <UsageForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("enabled");
});

test("space disables usage tracking on all enabled models", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <UsageForm draft={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      models: expect.objectContaining({
        definitions: { claude: { usage: { disabled: true } } },
      }),
    }),
  );
});

test("notes when there are no enabled models", () => {
  const empty = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
  } as never;
  const { lastFrame } = render(
    <UsageForm draft={empty} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("no enabled models");
});
