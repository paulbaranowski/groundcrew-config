/** Result of parsing a package-manager probe's stdout. */
export interface InstalledProbe {
  installed: boolean;
  version: string | null;
}

export const GROUNDCREW_PACKAGE = "@clipboard-health/groundcrew";
export const SAFEHOUSE_FORMULA_REF = "eugene1g/safehouse/agent-safehouse";
export const SAFEHOUSE_FORMULA_NAME = "agent-safehouse";

const NOT_INSTALLED: InstalledProbe = { installed: false, version: null };

// `npm ls -g <pkg> --json` exits non-zero when the package is missing but
// still writes a valid JSON body, so callers ignore the exit code and this
// parser keys off `dependencies` alone.
export function parseNpmLs(
  stdout: string,
  packageName: string,
): InstalledProbe {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    return NOT_INSTALLED;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return NOT_INSTALLED;
  }
  const deps = (data as Record<string, unknown>).dependencies;
  if (typeof deps !== "object" || deps === null) return NOT_INSTALLED;
  const info = (deps as Record<string, unknown>)[packageName];
  if (typeof info !== "object" || info === null) return NOT_INSTALLED;
  const version = (info as Record<string, unknown>).version;
  return {
    installed: true,
    version: typeof version === "string" ? version : null,
  };
}

const VERSION_RE = /^\d+(\.\d+)*(\S*)$/;

// `brew list --versions <formula>` prints "agent-safehouse 0.9.0" on success;
// only called when brew exited 0 (non-zero already means not installed).
export function parseBrewVersions(stdout: string): InstalledProbe {
  const parts = stdout.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return NOT_INSTALLED;
  if (parts.length === 1) return { installed: true, version: null };
  const version = parts[1]!;
  return {
    installed: true,
    version: VERSION_RE.test(version) ? version : null,
  };
}
