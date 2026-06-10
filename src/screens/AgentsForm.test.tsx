import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { AgentsForm } from "./AgentsForm.tsx";

const ESC = String.fromCharCode(27);
const DOWN = `${ESC}[B`;

function draftWith(definitions: Record<string, unknown>) {
  return {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    agents: { default: "claude", definitions },
  } as never;
}

const claudeOnly = draftWith({ claude: {} });
const both = draftWith({ claude: {}, codex: {} });

test("renders enable checkboxes for claude and codex", () => {
  const { lastFrame } = render(
    <AgentsForm draft={draftWith({ claude: {} })} onChange={() => {}} onBack={() => {}} />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("claude");
  expect(f).toContain("codex");
  expect(f).toContain("[x]"); // claude enabled
  expect(f).toContain("[ ]"); // codex disabled
});

test("shows the bypass sub-option only when claude is enabled", () => {
  const on = render(
    <AgentsForm draft={claudeOnly} onChange={() => {}} onBack={() => {}} />,
  );
  // Match the toggle row's checkbox marker, not the bare phrase — the help text
  // now also mentions "bypass permission prompts".
  expect(on.lastFrame()).toContain("] bypass permission prompts");

  const off = render(
    <AgentsForm draft={draftWith({ codex: {} })} onChange={() => {}} onBack={() => {}} />,
  );
  expect(off.lastFrame()).not.toContain("] bypass permission prompts");
});

test("shows the bypass box checked when claude already bypasses", () => {
  const { lastFrame } = render(
    <AgentsForm
      draft={draftWith({ claude: { cmd: "claude --permission-mode bypassPermissions" } })}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  // two checked boxes: claude enabled, and bypass on
  expect((lastFrame() ?? "").match(/\[x\]/g)?.length).toBe(2);
});

test("space on the claude row disables claude", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <AgentsForm draft={both} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      agents: expect.objectContaining({ definitions: { codex: {} } }),
    }),
  );
});

test("space on the bypass row toggles bypass on claude", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentsForm draft={both} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write(DOWN); // down to the bypass sub-row
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("▸     [ ] bypass permission prompts"),
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      agents: expect.objectContaining({
        definitions: {
          claude: { cmd: "claude --permission-mode bypassPermissions" },
          codex: {},
        },
      }),
    }),
  );
});

test("space on the codex row enables codex", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentsForm draft={claudeOnly} onChange={onChange} onBack={() => {}} />,
  );
  // rows: claude (0), bypass (1), codex (2)
  stdin.write(DOWN);
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("▸     [ ] bypass permission prompts"),
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] codex"));
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      agents: expect.objectContaining({
        definitions: { claude: {}, codex: {} },
      }),
    }),
  );
});

test("custom agents are shown read-only for raw JSON editing", () => {
  const { lastFrame } = render(
    <AgentsForm
      draft={draftWith({ claude: {}, "my-agent": { cmd: "foo" } })}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("my-agent");
  expect(f).toContain("raw JSON");
});

test("enter on an agent row opens its detail editor", async () => {
  const { lastFrame, stdin } = render(
    <AgentsForm draft={claudeOnly} onChange={() => {}} onBack={() => {}} />,
  );
  stdin.write("\r"); // enter on the focused claude row
  await vi.waitFor(() => expect(lastFrame()).toContain("Agent: claude"));
  expect(lastFrame()).toContain("sandbox.agent");
});

test("saving the detail editor writes the agent definition", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <AgentsForm draft={claudeOnly} onChange={onChange} onBack={() => {}} />,
  );
  stdin.write("\r"); // open claude detail
  await vi.waitFor(() => expect(lastFrame()).toContain("Agent: claude"));
  stdin.write("\r"); // save unchanged (empty def)
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      agents: expect.objectContaining({ definitions: { claude: {} } }),
    }),
  );
});

test("esc returns to the home screen", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <AgentsForm draft={claudeOnly} onChange={() => {}} onBack={onBack} />,
  );
  stdin.write(ESC); // escape
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
