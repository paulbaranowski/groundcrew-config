import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { UsageForm } from "./UsageForm.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
  agents: { default: "claude", definitions: { claude: {} } },
} as never;

test("shows tracking enabled by default", () => {
  const { lastFrame } = render(
    <UsageForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("enabled");
});

test("space disables usage tracking on all enabled agents", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <UsageForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
    />,
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
    <UsageForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Usage Limits");
  expect(f).toContain("sessionLimitPercentage");
});

test("editing the limit writes orchestrator.sessionLimitPercentage", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <UsageForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
    />,
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
    <UsageForm
      draft={empty}
      baseline={empty}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("no enabled agents");
});

test("marks a changed sessionLimitPercentage with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    agents: { default: "claude", definitions: { claude: {} } },
  } as never;
  const next = {
    ...(baseline as object),
    orchestrator: { sessionLimitPercentage: 80 },
  } as never;
  const { lastFrame } = render(
    <UsageForm
      draft={next}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("sessionLimitPercentage")) ?? "";
  expect(line).toContain("●");
});

test("marks the tracking toggle with ● when its enabled-ness changed", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    agents: { default: "claude", definitions: { claude: {} } },
  } as never;
  const next = {
    ...(baseline as object),
    agents: {
      default: "claude",
      definitions: { claude: { usage: { disabled: true } } },
    },
  } as never;
  const { lastFrame } = render(
    <UsageForm
      draft={next}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("Usage tracking")) ?? "";
  expect(line).toContain("●");
});
