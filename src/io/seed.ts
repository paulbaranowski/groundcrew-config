import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_INITIAL_PROMPT,
  DEFAULT_PROMPT_FILE,
  defaultDraft,
} from "../domain/defaults.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { targetPath, type Target } from "./save.ts";

/**
 * Seed a brand-new config: write the starter {@link DEFAULT_PROMPT_FILE} next to
 * where the config will be saved (so groundcrew's `promptFile` resolves and
 * validation is green from the first frame), then return the default draft.
 *
 * The prompt file is written eagerly — before the user saves — because the live
 * validator reads it; an existing file is never clobbered. The config dir is the
 * same one `saveDraft` writes to, so the relative `promptFile` lines up on save.
 */
export function seedNewConfig(target: Target): ConfigDraft {
  const dir = path.dirname(targetPath(target));
  const promptPath = path.join(dir, DEFAULT_PROMPT_FILE);
  if (!existsSync(promptPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(promptPath, DEFAULT_INITIAL_PROMPT);
  }
  return defaultDraft();
}
