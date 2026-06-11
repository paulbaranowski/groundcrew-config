import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DEFAULT_INITIAL_PROMPT, defaultDraft } from "../domain/defaults.ts";
import { seedNewConfig } from "./seed.ts";

function dir(): string {
  return mkdtempSync(path.join(tmpdir(), "cc-seed-"));
}

test("writes the starter prompt file and returns the default draft", () => {
  const cwd = dir();
  const draft = seedNewConfig({ scope: "local", cwd });

  expect(draft).toEqual(defaultDraft());
  const promptPath = path.join(cwd, "prompt-initial.md");
  expect(existsSync(promptPath)).toBe(true);
  expect(readFileSync(promptPath, "utf8")).toBe(DEFAULT_INITIAL_PROMPT);
});

test("creates the config dir when it does not exist yet", () => {
  const cwd = path.join(dir(), "nested", "groundcrew");
  expect(existsSync(cwd)).toBe(false);

  seedNewConfig({ scope: "local", cwd });

  expect(existsSync(path.join(cwd, "prompt-initial.md"))).toBe(true);
});

test("never clobbers an existing prompt file", () => {
  const cwd = dir();
  const promptPath = path.join(cwd, "prompt-initial.md");
  writeFileSync(promptPath, "my edited prompt");

  seedNewConfig({ scope: "local", cwd });

  expect(readFileSync(promptPath, "utf8")).toBe("my edited prompt");
});
