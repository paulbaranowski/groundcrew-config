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
  try {
    if (!existsSync(promptPath)) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(promptPath, DEFAULT_INITIAL_PROMPT);
    }
  } catch {
    // The config dir isn't writable yet (locked-down first-run environment).
    // Don't crash startup before the UI mounts; fall back to an inline prompt so
    // the seeded draft stays valid — a dangling `promptFile` would otherwise fail
    // validation. The user's first save surfaces the real write error loudly.
    return { ...defaultDraft(), prompts: { initial: DEFAULT_INITIAL_PROMPT } };
  }
  return defaultDraft();
}
