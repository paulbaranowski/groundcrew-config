import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

export interface ExecResult {
  /** Exit code; -1 when the command never completed (spawn failure or timeout). */
  code: number;
  stdout: string;
  stderr: string;
  /** Present only when code === -1: why the command never completed. */
  error?: string;
}

export type ExecRunner = (
  cmd: string,
  args: string[],
  timeoutMs: number,
) => Promise<ExecResult>;

// The single subprocess seam for the setup layer. Never rejects: probe and
// install call sites branch on `code`/`error` instead of wrapping every call
// in try/catch, and a hung tool degrades to a report row instead of hanging
// the screen.
export const runCommand: ExecRunner = (cmd, args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        const err = error as NodeJS.ErrnoException & { killed?: boolean };
        // A numeric code means the process ran and exited non-zero: a normal
        // result for probes (npm ls exits 1 when the package is missing).
        if (typeof err.code === "number") {
          resolve({ code: err.code, stdout, stderr });
          return;
        }
        const reason =
          err.killed === true
            ? `timed out after ${timeoutMs}ms`
            : String(err.code ?? err.message);
        resolve({ code: -1, stdout, stderr, error: reason });
      },
    );
  });

/** First executable named `cmd` on PATH, or null. Env injectable for tests. */
export function which(
  cmd: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const dirs = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, cmd);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not here (or not executable); keep scanning.
    }
  }
  return null;
}
