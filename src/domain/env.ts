// Environment resolution for task-source credentials. This module mirrors
// groundcrew's own env-var precedence (e.g. GROUNDCREW_LINEAR_API_KEY before
// LINEAR_API_KEY) so the TUI's "is this key present?" status matches exactly
// what groundcrew will see at runtime. It reads env only — it never sets or
// resolves the actual secret value — so a status shown here can't disagree with
// how groundcrew later picks the key.

const LINEAR_KEY_SOURCES = [
  "GROUNDCREW_LINEAR_API_KEY",
  "LINEAR_API_KEY",
] as const;

export type LinearKeySource = (typeof LINEAR_KEY_SOURCES)[number];

export interface LinearKeyStatus {
  set: boolean;
  source?: LinearKeySource;
}

/** Mirror groundcrew's key resolution order; env is injected for testability. */
export function linearApiKeyStatus(
  env: Record<string, string | undefined>,
): LinearKeyStatus {
  for (const source of LINEAR_KEY_SOURCES) {
    const value = env[source];
    // Trim so a whitespace-only value isn't reported as a real key.
    if (value !== undefined && value.trim().length > 0) {
      return { set: true, source };
    }
  }
  return { set: false };
}
