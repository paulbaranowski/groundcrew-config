import {
  GROUNDCREW_PACKAGE,
  SAFEHOUSE_FORMULA_NAME,
  SAFEHOUSE_FORMULA_REF,
  parseBrewVersions,
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
  // npm ls exits non-zero when the package is missing but still writes valid
  // JSON, so parse stdout regardless of exit code.
  const probe = parseNpmLs(result.stdout, GROUNDCREW_PACKAGE);
  return probe.installed
    ? { action: "already-installed", version: probe.version, details: "" }
    : { action: "missing", version: null, details: "" };
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
  const after = await probeGroundcrew(deps);
  return { action: "installed", version: after.version, details: "" };
}

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
  const after = await probeSafehouseFormula(deps);
  return { action: "installed", version: after.version, details: "" };
}
