import { runCommand, which, type ExecRunner } from "./exec.ts";

export interface CrewDoctorResult {
  /** False when the crew binary is not on PATH (nothing was run). */
  available: boolean;
  /** crew doctor's exit status; -1 when it never completed. */
  code: number;
  /** Combined stdout+stderr, or guidance/failure text. */
  output: string;
}

interface CrewDoctorDeps {
  run: ExecRunner;
  which: (cmd: string) => string | null;
}

const CREW_DOCTOR_TIMEOUT_MS = 120_000;

/** Run groundcrew's own `crew doctor` and capture everything for display (F7). */
export async function runCrewDoctor(
  deps: CrewDoctorDeps = { run: runCommand, which },
): Promise<CrewDoctorResult> {
  if (deps.which("crew") === null) {
    return {
      available: false,
      code: -1,
      output:
        "crew not found on PATH - install groundcrew first (Setup screen, first row)",
    };
  }
  const result = await deps.run("crew", ["doctor"], CREW_DOCTOR_TIMEOUT_MS);
  // Partial output survives a timeout/spawn failure: the captured lines are
  // often the diagnostics the user needs, so the error is appended, not
  // substituted.
  const pieces = [result.stdout, result.stderr, result.error ?? ""]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    available: true,
    code: result.code,
    output: pieces.length > 0 ? pieces.join("\n") : "(no output)",
  };
}
