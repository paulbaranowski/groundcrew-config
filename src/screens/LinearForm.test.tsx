import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { LinearForm } from "./LinearForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows enabled when no disabling entry present", () => {
  const { lastFrame } = render(
    <LinearForm draft={base} env={{}} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("enabled");
});

test("space adds a disabling linear source", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <LinearForm draft={base} env={{}} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "linear", enabled: false }] }),
  );
});

test("reports API key detected with its source", () => {
  const { lastFrame } = render(
    <LinearForm
      draft={base}
      env={{ GROUNDCREW_LINEAR_API_KEY: "lin_api_x" }}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  expect(lastFrame()).toContain("API key");
  expect(lastFrame()).toContain("GROUNDCREW_LINEAR_API_KEY");
});

test("reports API key not set with the export hint", () => {
  const { lastFrame } = render(
    <LinearForm draft={base} env={{}} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("not set");
  expect(lastFrame()).toContain("export GROUNDCREW_LINEAR_API_KEY");
});
