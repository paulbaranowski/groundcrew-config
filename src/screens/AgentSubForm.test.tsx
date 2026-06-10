import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { AgentSubForm } from "./AgentSubForm.tsx";

const ESC = String.fromCharCode(27);
const DOWN = `${ESC}[B`;

test("renders the editable fields seeded from the definition", () => {
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={{ cmd: "claude --permission-mode auto" }}
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
  const { lastFrame } = render(
    <AgentSubForm
      name="claude"
      def={{}}
      sandboxRequired
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(lastFrame()).toContain("sandbox.agent is required");
});

test("enter saves the merged definition", async () => {
  const onSave = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentSubForm
      name="claude"
      def={{}}
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

test("esc cancels", async () => {
  const onCancel = vi.fn();
  const { stdin } = render(
    <AgentSubForm
      name="claude"
      def={{}}
      sandboxRequired={false}
      onSave={() => {}}
      onCancel={onCancel}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
});
