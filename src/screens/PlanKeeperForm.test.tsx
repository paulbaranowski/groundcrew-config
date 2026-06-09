import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { PlanKeeperForm } from "./PlanKeeperForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled state and the brew install line", () => {
  const { lastFrame } = render(
    <PlanKeeperForm draft={base} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("disabled");
  expect(lastFrame()).toContain("brew install paulbaranowski/tap/plan-keeper");
});

test("space enables the plan-keeper source", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <PlanKeeperForm draft={base} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      sources: [expect.objectContaining({ kind: "shell", name: "plans" })],
    }),
  );
});
