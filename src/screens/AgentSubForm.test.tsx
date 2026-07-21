import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { AgentSubForm } from "./AgentSubForm.tsx";

const ESC = String.fromCharCode(27);
const DOWN = `${ESC}[B`;

test("renders the editable fields seeded from the definition", () => {
  const def = { cmd: "claude --permission-mode auto" };
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Agent: claude");
  expect(f).toContain("cmd");
  expect(f).toContain("preLaunch");
  expect(f).toContain("preLaunchEnv");
  expect(f).toContain("sandbox.agent");
  expect(f).toContain("claude --permission-mode auto");
});

test("warns when sandbox is required but unset", () => {
  const def = {};
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("sandbox.agent is required");
});

test("enter saves the merged definition", async () => {
  const def = {};
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  // Move to sandbox.agent (row 5: cmd, color, preLaunch, test, env, sandbox)
  // and type a value, then save.
  for (let i = 0; i < 5; i++) stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› sandbox.agent"));
  stdin.write("claude");
  // Wait for the re-render (the "required" warning clears once filled) so the
  // save handler closes over the updated fields rather than the empty seed.
  await vi.waitFor(() => expect(lastFrame()).not.toContain("is required"));
  stdin.write("\r");
  expect(onSave).toHaveBeenCalledWith({ sandbox: { agent: "claude" } });
});

test("enter on the preLaunchEnv row opens the list editor, not save", async () => {
  const def = {};
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  // Move to the preLaunchEnv summary row (row 4: cmd, color, preLaunch, test,
  // env).
  for (let i = 0; i < 4; i++) stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› preLaunchEnv"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add env name"));
  expect(onSave).not.toHaveBeenCalled();
});

test("seeds the preLaunchEnv row count from the definition", () => {
  const def = { preLaunchEnv: ["GITHUB_TOKEN", "JIRA_API_TOKEN"] };
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("2 names — enter to edit");
});

test("groups preLaunch, its test, and preLaunchEnv under a Pre-launch heading", () => {
  const def = {};
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const lines = (lastFrame() ?? "").split("\n");
  const idx = (needle: string) =>
    lines.findIndex((l) => l.includes(needle));
  const heading = idx("Pre-launch");
  expect(heading).toBeGreaterThanOrEqual(0);
  // The three launch rows follow the heading, in order, and above sandbox.agent.
  expect(idx("preLaunch ")).toBeGreaterThan(heading);
  expect(idx("test preLaunch")).toBeGreaterThan(idx("preLaunch "));
  expect(idx("preLaunchEnv")).toBeGreaterThan(idx("test preLaunch"));
  expect(idx("sandbox.agent")).toBeGreaterThan(idx("preLaunchEnv"));
});

test("enter on the test row dry-runs preLaunch and reports value lengths", async () => {
  const probe = vi.fn().mockResolvedValue({
    rows: [
      { name: "GITHUB_TOKEN", length: 40 },
      { name: "JIRA_API_TOKEN", length: 0 },
    ],
    exitCode: 0,
    stderr: "",
    skipped: [],
  });
  const def = {
    preLaunch: `export JIRA_API_TOKEN="$(cat jira.token)"`,
    preLaunchEnv: ["GITHUB_TOKEN", "JIRA_API_TOKEN"],
  };
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
      probe={probe}
    />,
  );
  // Move to the test row (row 3: cmd, color, preLaunch, test).
  for (let i = 0; i < 3; i++) stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› test preLaunch"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("preLaunch dry-run"));
  const f = lastFrame() ?? "";
  expect(probe).toHaveBeenCalledWith(
    def.preLaunch,
    ["GITHUB_TOKEN", "JIRA_API_TOKEN"],
    {},
  );
  expect(f).toContain("GITHUB_TOKEN len=40");
  expect(f).toContain("JIRA_API_TOKEN empty (len=0)");
});

test("the test row is inert with no preLaunch hook and never spawns a probe", async () => {
  const probe = vi.fn();
  const def = { preLaunchEnv: ["GITHUB_TOKEN"] };
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
      probe={probe}
    />,
  );
  for (let i = 0; i < 3; i++) stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› test preLaunch"));
  expect(lastFrame()).toContain("add a preLaunch hook first");
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("add a preLaunch hook to test it"),
  );
  expect(probe).not.toHaveBeenCalled();
});

test("esc dismisses the dry-run result before cancelling the form", async () => {
  const onCancel = vi.fn();
  const probe = vi.fn().mockResolvedValue({
    rows: [{ name: "TOK", length: 5 }],
    exitCode: 0,
    stderr: "",
    skipped: [],
  });
  const def = { preLaunch: "export TOK=abc", preLaunchEnv: ["TOK"] };
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={onCancel}
      probe={probe}
    />,
  );
  for (let i = 0; i < 3; i++) stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› test preLaunch"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("preLaunch dry-run"));
  stdin.write(ESC); // first esc dismisses the panel
  await vi.waitFor(() => expect(lastFrame()).not.toContain("preLaunch dry-run"));
  expect(onCancel).not.toHaveBeenCalled();
  stdin.write(ESC); // second esc cancels the form
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});

test("esc cancels", async () => {
  const def = {};
  const onCancel = vi.fn();
  const { stdin } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={def}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});

test("marks a field whose buffered value differs from baseline with ●", () => {
  const baselineDef = {};
  const def = { cmd: "/usr/local/bin/claude" };
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={def}
      baselineDef={baselineDef}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const line =
    (lastFrame() ?? "").split("\n").find((l) => l.match(/\scmd\s/)) ?? "";
  expect(line).toContain("●");
});
