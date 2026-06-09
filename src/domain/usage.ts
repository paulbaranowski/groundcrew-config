import type { ConfigDraft } from "./types.ts";

type Models = ConfigDraft["models"];

function isDisabledSentinel(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { disabled?: boolean }).disabled === true
  );
}

/** True when there is at least one enabled model and every one opts out of usage. */
export function isUsageDisabled(models: Models): boolean {
  const definitions = models?.definitions ?? {};
  const entries = Object.values(definitions);
  if (entries.length === 0) return false;
  return entries.every((def) =>
    isDisabledSentinel((def as { usage?: unknown }).usage),
  );
}

/** Set/clear `usage: { disabled: true }` on every enabled model definition. */
export function setUsageDisabled(models: Models, disabled: boolean): Models {
  const definitions = models?.definitions ?? {};
  const next: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(definitions)) {
    const entry = { ...(def as Record<string, unknown>) };
    if (disabled) {
      entry.usage = { disabled: true };
    } else if (isDisabledSentinel(entry.usage)) {
      delete entry.usage;
    }
    next[name] = entry;
  }
  return { ...models, definitions: next } as Models;
}
