import type { ConfigDraft } from "./types.ts";

type Models = ConfigDraft["models"];
type Def = Record<string, unknown>;

/** Built-in model presets, in display order. An empty `{}` entry enables one. */
export const BUILTIN_MODELS = ["claude", "codex"] as const;

/** True when `name` has a definition entry (i.e. the model is enabled). */
export function isModelEnabled(models: Models, name: string): boolean {
  return Object.hasOwn(models?.definitions ?? {}, name);
}

/**
 * Enable or disable a model. Enabling adds an empty `{}` (which inherits the
 * built-in preset) only when absent — an existing entry is left untouched.
 * Disabling deletes the entry. `models.default` is never changed.
 */
export function setModelEnabled(
  models: Models,
  name: string,
  enabled: boolean,
): Models {
  const definitions = { ...(models?.definitions ?? {}) } as Record<string, Def>;
  if (enabled) {
    if (!(name in definitions)) definitions[name] = {};
  } else {
    delete definitions[name];
  }
  return { ...models, definitions } as Models;
}
