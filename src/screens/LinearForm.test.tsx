import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { LinearForm } from "./LinearForm.tsx";

const DOWN = `${String.fromCharCode(27)}[B`;
const base = { workspace: { projectDir: "~/d", knownRepositories: [] } } as never;

test("shows disabled by default and enables on space", () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <LinearForm draft={base} baseline={base} env={{}} onChange={onChange} onBack={() => {}} />,
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
    <LinearForm draft={draft} baseline={draft} env={{}} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [] }),
  );
});

test("shows team/name/status fields when enabled and edits the entry", async () => {
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources: [{ kind: "linear" }],
  } as never;
  const { lastFrame, stdin } = render(
    <LinearForm draft={draft} baseline={draft} env={{}} onChange={onChange} onBack={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("team");
  expect(f).toContain("statuses.inProgress");
  expect(f).toContain("statuses.inReview");

  // Down off the enable row onto the `team` field, then type — Space must NOT
  // toggle the source here, it must reach the field.
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› team"));
  stdin.write("E");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "linear", team: "E" }] }),
  );
});

test("reports API key detected with its source", () => {
  const { lastFrame } = render(
    <LinearForm
      draft={base}
      baseline={base}
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
    <LinearForm draft={base} baseline={base} env={{}} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("not set");
  expect(lastFrame()).toContain("export GROUNDCREW_LINEAR_API_KEY");
});

test("marks a changed team field with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "linear" as const }],
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "linear" as const, team: "Frontend" }],
  } as never;
  const { lastFrame } = render(
    <LinearForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
      env={{}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.includes("team")) ?? "";
  expect(line).toContain("●");
});

test("marks the enable toggle with ● when enabled-ness changed", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never;
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    sources: [{ kind: "linear" as const }],
  } as never;
  const { lastFrame } = render(
    <LinearForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
      env={{}}
    />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("Built-in Linear source")) ?? "";
  expect(line).toContain("●");
});
