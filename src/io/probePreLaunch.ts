import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** POSIX env var name; matches groundcrew's own accepted shape. */
const POSIX_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Wall-clock ceiling for a single dry-run. Long enough for a slow token mint,
 * short enough that a genuinely hung hook (blocking read, deadlocked child)
 * doesn't leave the TUI spinning; on timeout, execFile rejects and the
 * timed-out killed-child signal is surfaced in `stderr`.
 */
const PROBE_TIMEOUT_MS = 15_000;

/** One probed env var: the byte-safe character length its value ended up with. */
export interface ProbeRow {
  name: string;
  /** Character length of the exported value. 0 means empty (the bug signal). */
  length: number;
}

export interface ProbeResult {
  rows: ProbeRow[];
  /** Exit code of the preLaunch hook itself (0 = clean). */
  exitCode: number;
  /** Whatever the hook wrote to stderr (e.g. `cat: …: No such file`). */
  stderr: string;
  /** Names dropped for not matching the POSIX env-var-name shape. */
  skipped: string[];
}

/**
 * Parse the probe script's stdout into per-name lengths. The script prints one
 * `NAME\tLEN` line per requested name and a trailing `__rc=<code>` line. A name
 * absent from the output (the hook aborted before the loop, e.g. under
 * `set -e`) is reported as length 0 — an unmeasured value is, for our purposes,
 * as bad as an empty one. Exported so the parsing is unit-testable without
 * spawning a shell.
 */
export function parseProbeOutput(
  stdout: string,
  requestedNames: string[],
): { rows: ProbeRow[]; exitCode: number } {
  const lengths = new Map<string, number>();
  let exitCode = 0;
  let sawRc = false;
  for (const line of stdout.split("\n")) {
    const rc = /^__rc=(\d+)$/.exec(line);
    if (rc) {
      exitCode = Number(rc[1]);
      sawRc = true;
      continue;
    }
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const name = line.slice(0, tab);
    const len = Number(line.slice(tab + 1));
    if (Number.isFinite(len)) lengths.set(name, len);
  }
  const rows = requestedNames.map((name) => ({
    name,
    length: lengths.get(name) ?? 0,
  }));
  // No `__rc=` line means the hook aborted before the trailing echo; the shell's
  // own exit code (filled in by the caller) is the truthful signal there.
  return { rows, exitCode: sawRc ? exitCode : Number.NaN };
}

/**
 * Run `preLaunch` the way groundcrew will and report each `preLaunchEnv` name's
 * resulting value length, so an empty export (missing/mistyped token file, empty
 * file) is caught before launch instead of surfacing later as a generic 401.
 *
 * Fidelity to groundcrew's launch (see ~/dev/groundcrew launchCommand.ts):
 * - runs under `bash`, the shell groundcrew's staged launcher uses;
 * - `unset`s the probed names first, exactly as groundcrew scrubs `preLaunchEnv`
 *   before the hook, so an inherited value can't mask a hook that produces an
 *   empty string;
 * - substitutes `{{worktree}}` (no real worktree exists pre-launch — the caller
 *   passes a stand-in and surfaces the caveat).
 *
 * Non-POSIX names are skipped (they can't be shell identifiers) and returned in
 * `skipped`.
 */
export async function probePreLaunch(
  preLaunch: string,
  names: string[],
  options: { cwd?: string; worktree?: string; timeoutMs?: number } = {},
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
  // Dedup POSIX-valid names once, so `unset`, the report loop, and the parsed
  // rows all iterate the same sequence. Otherwise a repeated name would `unset`
  // once but produce two identical rows in the UI panel — harmless but ugly.
  const seen = new Set<string>();
  const valid: string[] = [];
  const skipped: string[] = [];
  for (const name of names) {
    if (!POSIX_NAME.test(name)) {
      skipped.push(name);
    } else if (!seen.has(name)) {
      seen.add(name);
      valid.push(name);
    }
  }

  const worktree = options.worktree ?? options.cwd ?? process.cwd();
  const rendered = preLaunch.replaceAll("{{worktree}}", worktree);
  const unsetLine = valid.length > 0 ? `unset ${valid.join(" ")}` : ":";
  const reportLoop = valid
    .map(
      (name) =>
        `__v="\${${name}}"; printf '%s\\t%d\\n' ${name} "\${#__v}"`,
    )
    .join("\n");
  const script = [
    unsetLine,
    rendered,
    "__rc=$?",
    reportLoop,
    'printf "__rc=%d\\n" "$__rc"',
  ].join("\n");

  try {
    const { stdout, stderr } = await run("bash", ["-c", script], {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
    });
    // A hook can write to stderr (e.g. `cat: …: No such file`) yet still exit 0 —
    // `export X="$(cat missing)"` masks the substitution failure — so surface
    // stderr even on the success path; length 0 is the primary tell.
    const { rows, exitCode } = parseProbeOutput(stdout, valid);
    return {
      rows,
      exitCode: Number.isNaN(exitCode) ? 0 : exitCode,
      stderr: stderr.trim(),
      skipped,
    };
  } catch (error) {
    // `execFile`'s error `code` is a number on process exit, but a string on
    // spawn/kill failures (`ENOENT`, `ETIMEDOUT`). Only trust numeric codes;
    // fall back to 1 otherwise, and annotate stderr on timeout so the panel
    // can distinguish a hung hook from a normal non-zero exit.
    const shellError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      signal?: string;
      killed?: boolean;
    };
    const { rows, exitCode } = parseProbeOutput(shellError.stdout ?? "", valid);
    const fallback = typeof shellError.code === "number" ? shellError.code : 1;
    const timedOut = shellError.killed === true || shellError.code === "ETIMEDOUT";
    const baseStderr = (shellError.stderr ?? "").trim();
    const stderr = timedOut
      ? [`preLaunch timed out after ${timeoutMs / 1000}s`, baseStderr]
          .filter(Boolean)
          .join("\n")
      : baseStderr;
    return {
      rows,
      exitCode: Number.isNaN(exitCode) ? fallback : exitCode,
      stderr,
      skipped,
    };
  }
}
