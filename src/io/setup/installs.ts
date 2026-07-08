import {
  GROUNDCREW_PACKAGE,
  SAFEHOUSE_FORMULA_NAME,
  SAFEHOUSE_FORMULA_REF,
  parseBrewVersions,
  parseCrewVersion,
  parseNpmLs,
} from "../../domain/setup/installProbe.ts";
import {
  runCommand,
  which,
  type ExecResult,
  type ExecRunner,
} from "./exec.ts";

/**
 * One probe-or-install outcome, ported verbatim from the groundcrew-setup
 * plugin's install_*.py JSON contract:
 *   already-installed  present (probe, or install short-circuited: no-op)
 *   installed          installed during this invocation
 *   missing            not installed (probe only)
 *   failed             tool unavailable, spawn failure, or install failed
 */
export interface InstallReport {
  action: "already-installed" | "installed" | "missing" | "failed";
  version: string | null;
  details: string;
}

// Seam for tests, mirroring io/upgrade.ts: probes and installs never touch
// the real npm/brew in the vitest suite.
export interface InstallDeps {
  run: ExecRunner;
  which: (cmd: string) => string | null;
}

export function defaultInstallDeps(): InstallDeps {
  return { run: runCommand, which };
}

const PROBE_TIMEOUT_MS = 30_000;
const BREW_PROBE_TIMEOUT_MS = 15_000;
const CREW_VERSION_TIMEOUT_MS = 15_000;
const INSTALL_TIMEOUT_MS = 600_000;

function failureDetails(result: ExecResult, fallback: string): string {
  return (
    result.error ?? (result.stderr.trim() || result.stdout.trim() || fallback)
  );
}

export async function probeGroundcrew(
  deps: InstallDeps = defaultInstallDeps(),
): Promise<InstallReport> {
  if (deps.which("npm") === null) {
    // No npm to probe or install with - but a `crew` already on PATH means
    // groundcrew is installed and usable regardless, so honor that before
    // falling back to the missing-toolchain guidance.
    const viaCrew = await probeCrewOnPath(deps);
    if (viaCrew.action === "already-installed") return viaCrew;
    return {
      action: "failed",
      version: null,
      details:
        "npm not found on PATH - install Node.js from https://nodejs.org",
    };
  }
  const result = await deps.run(
    "npm",
    ["ls", "-g", GROUNDCREW_PACKAGE, "--depth", "0", "--json"],
    PROBE_TIMEOUT_MS,
  );
  // A spawn failure or timeout is a broken probe, not evidence of absence:
  // reporting it as "missing" would invite a spurious install.
  if (result.error !== undefined) {
    return { action: "failed", version: null, details: result.error };
  }
  // npm ls exits non-zero when the package is missing but still writes valid
  // JSON, so parse stdout regardless of exit code.
  const probe = parseNpmLs(result.stdout, GROUNDCREW_PACKAGE);
  if (probe.installed) {
    return { action: "already-installed", version: probe.version, details: "" };
  }
  // npm ls -g only sees the active npm's global tree, whose prefix can differ
  // from where groundcrew actually lives (Homebrew node vs nvm). Before
  // concluding "missing", fall back to the PATH-authoritative signal - whether
  // `crew` is runnable - so this probe stops disagreeing with crewDoctor.
  return probeCrewOnPath(deps);
}

// PATH-authoritative fallback for probeGroundcrew: `crew` on PATH means
// groundcrew is installed and usable regardless of which npm is active. Mirrors
// crewDoctor's trust in which("crew"). Absent => genuinely missing.
async function probeCrewOnPath(deps: InstallDeps): Promise<InstallReport> {
  if (deps.which("crew") === null) {
    return { action: "missing", version: null, details: "" };
  }
  return {
    action: "already-installed",
    version: await crewVersion(deps),
    details: "",
  };
}

// Best-effort version for the PATH fallback: `crew --version` prints a bare
// "4.45.2" and exits 0. A non-zero exit or spawn failure leaves version null -
// InstallReport tolerates it and the Setup row still reads installed.
async function crewVersion(deps: InstallDeps): Promise<string | null> {
  const result = await deps.run("crew", ["--version"], CREW_VERSION_TIMEOUT_MS);
  if (result.error !== undefined || result.code !== 0) return null;
  return parseCrewVersion(result.stdout);
}

export async function installGroundcrew(
  deps: InstallDeps = defaultInstallDeps(),
): Promise<InstallReport> {
  const existing = await probeGroundcrew(deps);
  // Idempotent: already-installed and failed both short-circuit; only a
  // clean "missing" proceeds to mutate the system.
  if (existing.action !== "missing") return existing;
  const result = await deps.run(
    "npm",
    ["install", "-g", GROUNDCREW_PACKAGE],
    INSTALL_TIMEOUT_MS,
  );
  if (result.code !== 0) {
    return {
      action: "failed",
      version: null,
      details: failureDetails(result, "npm install failed"),
    };
  }
  // Trust the re-probe, not npm's exit code: a "successful" install that the
  // probe still can't see must not render as installed ✓ while doctor
  // simultaneously reports the package broken.
  const after = await probeGroundcrew(deps);
  if (after.action !== "already-installed") {
    return {
      action: "failed",
      version: null,
      details:
        after.details ||
        `npm install exited 0 but ${GROUNDCREW_PACKAGE} is still not detected`,
    };
  }
  return { action: "installed", version: after.version, details: "" };
}

// Safehouse install/probe is brew-only and macOS-only: every call site gates on
// host.isSafehouseSupported first (doctor.ts, SetupScreen.tsx), so these never
// run on Linux. The Linux sandbox story is srt (see domain/io setup/host.ts),
// which ships with groundcrew and needs no formula install here.
export async function probeSafehouseFormula(
  deps: InstallDeps = defaultInstallDeps(),
): Promise<InstallReport> {
  if (deps.which("brew") === null) {
    return {
      action: "failed",
      version: null,
      details: "brew not found on PATH - install Homebrew from https://brew.sh",
    };
  }
  const result = await deps.run(
    "brew",
    ["list", "--versions", SAFEHOUSE_FORMULA_NAME],
    BREW_PROBE_TIMEOUT_MS,
  );
  // A spawn failure or timeout is a broken probe, not evidence of absence.
  if (result.error !== undefined) {
    return { action: "failed", version: null, details: result.error };
  }
  if (result.code !== 0) {
    return { action: "missing", version: null, details: "" };
  }
  const probe = parseBrewVersions(result.stdout);
  return probe.installed
    ? { action: "already-installed", version: probe.version, details: "" }
    : { action: "missing", version: null, details: "" };
}

export async function installSafehouse(
  deps: InstallDeps = defaultInstallDeps(),
): Promise<InstallReport> {
  const existing = await probeSafehouseFormula(deps);
  if (existing.action !== "missing") return existing;
  // The tap (eugene1g/safehouse) is auto-added by `brew install` on first
  // use; no separate `brew tap` step is needed.
  const result = await deps.run(
    "brew",
    ["install", SAFEHOUSE_FORMULA_REF],
    INSTALL_TIMEOUT_MS,
  );
  if (result.code !== 0) {
    return {
      action: "failed",
      version: null,
      details: failureDetails(result, "brew install failed"),
    };
  }
  // Same as installGroundcrew: only the re-probe decides success.
  const after = await probeSafehouseFormula(deps);
  if (after.action !== "already-installed") {
    return {
      action: "failed",
      version: null,
      details:
        after.details ||
        `brew install exited 0 but ${SAFEHOUSE_FORMULA_NAME} is still not detected`,
    };
  }
  return { action: "installed", version: after.version, details: "" };
}
