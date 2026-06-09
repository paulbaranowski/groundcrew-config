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
