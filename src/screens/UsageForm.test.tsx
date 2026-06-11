import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { UsageForm } from "./UsageForm.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
  agents: { default: "claude", definitions: { claude: {} } },
} as never;

test("shows tracking enabled by default", () => {
  const { lastFrame } = render(
    <UsageForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("enabled");
});

test("space disables usage tracking on all enabled agents", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <UsageForm draft={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      agents: expect.objectContaining({
        definitions: { claude: { usage: { disabled: true } } },
      }),
    }),
  );
});

test("titled 'Usage Limits' and shows the session limit field", () => {
  const { lastFrame } = render(
    <UsageForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Usage Limits");
  expect(f).toContain("sessionLimitPercentage");
});

test("editing the limit writes orchestrator.sessionLimitPercentage", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <UsageForm draft={draft} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write("\x1b[B"); // down-arrow to the limit field
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("› sessionLimitPercentage"),
  );
  stdin.write("7");
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        orchestrator: expect.objectContaining({ sessionLimitPercentage: 7 }),
      }),
    ),
  );
});

test("notes when there are no enabled agents", () => {
  const empty = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
  } as never;
  const { lastFrame } = render(
    <UsageForm draft={empty} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("no enabled agents");
});
