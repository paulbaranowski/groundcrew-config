import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { LinearForm } from "./LinearForm.tsx";

test("shows enabled when no disabling entry present", () => {
  const { lastFrame } = render(
    <LinearForm
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("enabled");
});

test("space adds a disabling linear source", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <LinearForm
      draft={{ workspace: { projectDir: "~/d", knownRepositories: [] } } as never}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "linear", enabled: false }] }),
  );
});
