import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { PromptsBrowser } from "./PromptsBrowser.tsx";

const draft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
} as never;

function tmpConfigDir(): string {
  return mkdtempSync(path.join(tmpdir(), "crew-config-promptsbrowser-"));
}

test("lists the bundled autonomous prompt with its title", () => {
  const { lastFrame } = render(
    <PromptsBrowser
      draft={draft}
      configDir={tmpConfigDir()}
      onInstalled={() => {}}
      onBack={() => {}}
    />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Packaged prompts");
  expect(f).toContain("Autonomous task → PR");
});

test("esc calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <PromptsBrowser
      draft={draft}
      configDir={tmpConfigDir()}
      onInstalled={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write("\x1b");
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("enter installs the focused prompt (writes file + reports relative path)", async () => {
  const configDir = tmpConfigDir();
  const onInstalled = vi.fn();
  const { stdin } = render(
    <PromptsBrowser
      draft={draft}
      configDir={configDir}
      onInstalled={onInstalled}
      onBack={() => {}}
    />,
  );
  stdin.write("\r");
  await vi.waitFor(() => expect(onInstalled).toHaveBeenCalled());
  const [nextDraft, relativePath] = onInstalled.mock.calls[0] ?? [];
  expect(relativePath).toBe("prompts/autonomous.md");
  expect(
    (nextDraft as { prompts?: { promptFile?: string } }).prompts?.promptFile,
  ).toBe("prompts/autonomous.md");
  const installedAt = path.join(configDir, "prompts", "autonomous.md");
  expect(existsSync(installedAt)).toBe(true);
  expect(readFileSync(installedAt, "utf8")).toContain(
    "# Autonomous task → PR prompt",
  );
});
