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
  // Move to sandbox.agent (row 4) and type a value, then save.
  for (let i = 0; i < 4; i++) stdin.write(DOWN);
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
  // Move to the preLaunchEnv summary row (row 3: cmd, color, preLaunch, env).
  for (let i = 0; i < 3; i++) stdin.write(DOWN);
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
