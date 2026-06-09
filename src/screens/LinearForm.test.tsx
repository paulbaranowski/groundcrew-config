import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { LinearForm } from "./LinearForm.tsx";

const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled by default and enables on space", () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <LinearForm draft={base} env={{}} onChange={onChange} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("disabled");
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "linear" }] }),
  );
});

test("space on an enabled Linear removes the entry", () => {
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear" }],
  } as never;
  const { stdin } = render(
    <LinearForm draft={draft} env={{}} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [] }),
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
