import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled state and the brew install line", () => {
  const { lastFrame } = render(
    <PlanKeeperForm draft={base} baseline={base} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("disabled");
  expect(lastFrame()).toContain("brew install paulbaranowski/tap/plan-keeper");
});

test("space enables the plan-keeper source under the new name", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <PlanKeeperForm draft={base} baseline={base} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      sources: [expect.objectContaining({ kind: "shell", name: "plankeeper" })],
    }),
  );
});

test("displays the integration commands wired up on the live entry", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      {
        kind: "shell",
        name: "plankeeper",
        commands: { fetch: "/opt/homebrew/bin/plan-keeper crew fetch" },
      },
    ],
  } as never;
  const { lastFrame } = render(
    <PlanKeeperForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Commands:");
  expect(lastFrame()).toContain("fetch");
  expect(lastFrame()).toContain("/opt/homebrew/bin/plan-keeper crew fetch");
});

test("displays sandboxWritePaths from the live entry", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      {
        kind: "shell",
        name: "plankeeper",
        commands: { fetch: "plan-keeper crew fetch" },
        sandboxWritePaths: ["~/plans", "/var/log/plans"],
      },
    ],
  } as never;
  const { lastFrame } = render(
    <PlanKeeperForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Sandbox write paths:");
  expect(lastFrame()).toContain("~/plans");
  expect(lastFrame()).toContain("/var/log/plans");
});

test("omits the sandbox section when plan-keeper has no sandboxWritePaths", () => {
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [
      {
        kind: "shell",
        name: "plankeeper",
        commands: { fetch: "plan-keeper crew fetch" },
      },
    ],
  } as never;
  const { lastFrame } = render(
    <PlanKeeperForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).not.toContain("Sandbox write paths:");
});

test("marks the enable toggle with ● when enabled-ness differs from baseline", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [
      {
        kind: "shell" as const,
        name: "plankeeper",
        commands: { listTasks: "x" },
      },
    ],
  } as never;
  const { lastFrame } = render(
    <PlanKeeperForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("plan-keeper")) ??
    "";
  expect(line).toContain("●");
});
