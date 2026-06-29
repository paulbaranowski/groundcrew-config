import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { PromptsScreen } from "./PromptsScreen.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
} as never;

function tmpConfigDir(): string {
  return mkdtempSync(path.join(tmpdir(), "crew-config-promptsscreen-"));
}

test("renders the two prompt fields plus a browse entry", () => {
  const { lastFrame } = render(
    <PromptsScreen
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      configDir={tmpConfigDir()}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Prompts");
  expect(f).toContain("initial");
  expect(f).toContain("promptFile");
  expect(f).toContain("Browse packaged prompts");
});

test("esc on the form calls onBack", async () => {
  const onBack = vi.fn();
  const { lastFrame, stdin } = render(
    <PromptsScreen
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={onBack}
      configDir={tmpConfigDir()}
    />,
  );
  // Let Ink commit and the useInput effect subscribe before the first keystroke,
  // otherwise it can be dropped (CLAUDE.md: "type immediately and the first
  // keystroke is dropped").
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Prompts"));
  stdin.write("\x1b");
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("down twice + enter opens the packaged-prompts browser", async () => {
  const { lastFrame, stdin } = render(
    <PromptsScreen
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
      configDir={tmpConfigDir()}
    />,
  );
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Prompts"));
  // The two ↓ presses can stay back-to-back since `cursorRef` updates
  // synchronously inside `moveCursor` — only the first keystroke needs the
  // post-render settle.
  stdin.write("\x1b[B");
  stdin.write("\x1b[B");
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Packaged prompts"),
  );
});
