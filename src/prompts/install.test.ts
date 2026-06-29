import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { installPrompt } from "./install.ts";
import type { PackagedPrompt } from "./loader.ts";

const samplePrompt: PackagedPrompt = {
  slug: "demo",
  title: "Demo",
  description: "A demo prompt.",
  body: "Hello from the demo prompt.\n",
};

function freshDir(): string {
  return mkdtempSync(path.join(tmpdir(), "crew-config-install-"));
}

test("writes the prompt body to <configDir>/prompts/<slug>.md", () => {
  const configDir = freshDir();
  const result = installPrompt({} as never, configDir, samplePrompt);
  expect(result.relativePath).toBe("prompts/demo.md");
  expect(result.absolutePath).toBe(path.join(configDir, "prompts", "demo.md"));
  expect(readFileSync(result.absolutePath, "utf8")).toBe(samplePrompt.body);
});

test("sets prompts.promptFile and clears prompts.initial in the draft", () => {
  const configDir = freshDir();
  const draft = { prompts: { initial: "old inline prompt" } } as never;
  const result = installPrompt(draft, configDir, samplePrompt);
  const next = result.draft as unknown as {
    prompts: { promptFile?: string; initial?: string };
  };
  expect(next.prompts.promptFile).toBe("prompts/demo.md");
  expect(next.prompts.initial).toBeUndefined();
});

test("creates the prompts/ subdir even when it doesn't exist", () => {
  const configDir = freshDir();
  // No mkdir on the test side — install must create it itself.
  const result = installPrompt({} as never, configDir, samplePrompt);
  expect(readFileSync(result.absolutePath, "utf8")).toContain("demo prompt");
});

test("appends a trailing newline if the body lacks one", () => {
  const configDir = freshDir();
  const noNewline: PackagedPrompt = { ...samplePrompt, body: "no newline" };
  const result = installPrompt({} as never, configDir, noNewline);
  expect(readFileSync(result.absolutePath, "utf8")).toBe("no newline\n");
});
