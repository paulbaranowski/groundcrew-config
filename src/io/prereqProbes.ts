import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Environment probes for a manifest source's setup state: is a prerequisite
 * binary on PATH, does a secret file exist under the source's installDir.
 * Read-only and spawn-free (a plain PATH scan, not `which`), so the screen can
 * run them synchronously on mount. Injected into `ManifestSourceForm` as props
 * so tests substitute fakes.
 */

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
  return p;
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** True when `bin` resolves to an executable file on the given PATH. */
export function binOnPath(
  bin: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const searchPath = env.PATH ?? "";
  return searchPath
    .split(path.delimiter)
    .filter((dir) => dir.length > 0)
    .some((dir) => isExecutableFile(path.join(expandHome(dir), bin)));
}

/** True when `file` exists under the manifest's (possibly `~`-prefixed) installDir. */
export function secretFileExists(installDir: string, file: string): boolean {
  try {
    return statSync(path.join(expandHome(installDir), file)).isFile();
  } catch {
    return false;
  }
}
