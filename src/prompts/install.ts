// Installs a packaged prompt into the user's config dir and flips the draft to
// point at it via `prompts.promptFile` (clearing the mutually-exclusive
// `prompts.initial`).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setByPath } from "../domain/draftPath.ts";
import type { ConfigDraft } from "../domain/types.ts";
import type { PackagedPrompt } from "./loader.ts";

export interface InstallResult {
  draft: ConfigDraft;
  /** Full on-disk path the prompt was written to. */
  absolutePath: string;
  /** What we stored in `prompts.promptFile` (relative to configDir). */
  relativePath: string;
}

export function installPrompt(
  draft: ConfigDraft,
  configDir: string,
  prompt: PackagedPrompt,
): InstallResult {
  const promptsDir = path.join(configDir, "prompts");
  mkdirSync(promptsDir, { recursive: true });
  const absolutePath = path.join(promptsDir, `${prompt.slug}.md`);
  const body = prompt.body.endsWith("\n") ? prompt.body : `${prompt.body}\n`;
  writeFileSync(absolutePath, body);

  const relativePath = `prompts/${prompt.slug}.md`;
  const cleared = setByPath(
    draft as unknown as Record<string, unknown>,
    "prompts.initial",
    undefined,
  );
  const next = setByPath(cleared, "prompts.promptFile", relativePath);
  return {
    draft: next as unknown as ConfigDraft,
    absolutePath,
    relativePath,
  };
}
