import { homedir } from "node:os";
import {
  computeSrtReadiness,
  deriveCapabilities,
  SRT_APT_INSTALL,
} from "../../domain/setup/host.ts";
import {
  defaultInstallDeps,
  probeGroundcrew,
  type InstallDeps,
  type InstallReport,
} from "./installs.ts";
import {
  probeClearance,
  probeSafehouse,
  type ClearanceStatus,
  type SafehouseStatus,
} from "./probes.ts";

/** srt runner readiness on Linux. null in DoctorReport off Linux (see collect). */
export interface SrtStatus {
  /** True when the platform can run srt at all (macOS or Linux). */
  supported: boolean;
  /** True when every Linux srt dep is on PATH. */
  ready: boolean;
  /** Human labels of the missing Linux deps, in SRT_LINUX_DEPS order. */
  missing: string[];
}

export interface DoctorReport {
  platform: string;
  groundcrew: InstallReport;
  clearance: ClearanceStatus;
  /** null = not applicable (safehouse is macOS sandbox-exec based). */
  safehouse: SafehouseStatus | null;
  /** Linux srt-runner deps; null off Linux (macOS uses safehouse). */
  srt: SrtStatus | null;
  healthy: boolean;
}

// Everything ambient is injected so the vitest suite runs doctor against a
// temp HOME and fake npm/brew, mirroring how App takes initialDraft/target.
export interface DoctorDeps {
  home: string;
  platform: string;
  env: NodeJS.ProcessEnv;
  installDeps: InstallDeps;
}

export function defaultDoctorDeps(): DoctorDeps {
  return {
    home: homedir(),
    platform: process.platform,
    env: process.env,
    installDeps: defaultInstallDeps(),
  };
}

// Daemon staleness and srt readiness are deliberately NOT health gates: the
// clearance daemon starts on demand, and srt is an opt-in Linux runner (the
// platform default is sdx), so missing srt deps degrade a row, not the machine.
export function isHealthy(report: Omit<DoctorReport, "healthy">): boolean {
  if (report.groundcrew.action !== "already-installed") return false;
  const c = report.clearance;
  if (
    !c.personalFileExists ||
    !c.personalFileHasClaudeHosts ||
    !c.envExported
  ) {
    return false;
  }
  const s = report.safehouse;
  if (s !== null) {
    if (
      !s.binaryAvailable ||
      !s.brewFormulaInstalled ||
      !s.envExported ||
      !s.sidecarPresent ||
      !s.sidecarHasFunctions
    ) {
      return false;
    }
  }
  return true;
}

export async function collectDoctorReport(
  deps: DoctorDeps = defaultDoctorDeps(),
): Promise<DoctorReport> {
  const groundcrew = await probeGroundcrew(deps.installDeps);
  const clearance = probeClearance(deps.home, deps.env);
  // One capability snapshot decides which sandbox story this platform gets:
  // macOS -> safehouse, Linux -> srt deps, other -> neither.
  const caps = deriveCapabilities(deps.platform, {
    bwrap: deps.installDeps.which("bwrap") !== null,
    socat: deps.installDeps.which("socat") !== null,
    rg: deps.installDeps.which("rg") !== null,
  });
  const safehouse = caps.isSafehouseSupported
    ? await probeSafehouse(deps.home, deps.env, deps.installDeps)
    : null;
  const srt = caps.isLinux
    ? {
        supported: caps.isSrtSupported,
        ...computeSrtReadiness(caps),
      }
    : null;
  const partial = {
    platform: deps.platform,
    groundcrew,
    clearance,
    safehouse,
    srt,
  };
  return { ...partial, healthy: isHealthy(partial) };
}

function row(ok: boolean, label: string, detail: string): string {
  return `  ${ok ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  const g = report.groundcrew;
  lines.push(
    row(
      g.action === "already-installed",
      "groundcrew (npm global)",
      g.action === "already-installed"
        ? (g.version ?? "installed")
        : g.details || g.action,
    ),
  );

  const c = report.clearance;
  lines.push(
    row(
      c.personalFileExists && c.personalFileHasClaudeHosts,
      "clearance personal-allow-hosts",
      c.personalFileExists
        ? c.personalFileHasClaudeHosts
          ? "claude hosts present"
          : "missing claude hosts"
        : "missing",
    ),
  );
  lines.push(
    row(
      c.envExported,
      "clearance env",
      c.envExported ? "exported" : "not exported",
    ),
  );
  lines.push(
    `  - clearance daemon: ${
      c.daemonPid === null
        ? "not running (starts on demand)"
        : `pid ${c.daemonPid}, refreshed ${c.daemonAgeSeconds ?? "?"}s ago`
    }`,
  );

  const s = report.safehouse;
  if (report.srt !== null) {
    const srt = report.srt;
    lines.push(
      row(
        srt.ready,
        "srt sandbox (Linux)",
        srt.ready
          ? "bubblewrap/socat/ripgrep present"
          : `missing ${srt.missing.join(", ")} - ${SRT_APT_INSTALL}`,
      ),
    );
  } else if (s === null) {
    lines.push(
      `  - local sandbox: none on ${report.platform} (macOS or Linux only)`,
    );
  } else {
    lines.push(
      row(
        s.binaryAvailable && s.brewFormulaInstalled,
        "safehouse (brew formula)",
        s.binaryAvailable ? (s.binaryPath ?? "on PATH") : "not installed",
      ),
    );
    lines.push(
      row(
        s.sidecarPresent && s.sidecarHasFunctions,
        "safehouse sidecar",
        s.sidecarPresent
          ? s.sidecarHasFunctions
            ? "safe()/safe-claude() defined"
            : "missing wrapper functions"
          : "missing",
      ),
    );
    lines.push(
      row(
        s.envExported,
        "safehouse env",
        s.envExported ? "exported" : "not exported",
      ),
    );
  }

  lines.push("");
  lines.push(
    report.healthy
      ? "machine setup looks healthy"
      : "setup incomplete - run crew-config and open Setup",
  );
  return lines.join("\n");
}

/**
 * The `crew-config doctor [--json]` runner. Read-only: probes only, never
 * installs or writes. Exit codes: 0 healthy, 1 something broken, 2 bad
 * arguments. Unknown args are rejected loudly, matching locate()'s posture
 * on unknown flags.
 */
export async function runDoctor(
  argv: string[],
  deps: DoctorDeps = defaultDoctorDeps(),
  log: (line: string) => void = console.log,
): Promise<number> {
  const unknown = argv.find((a) => a !== "--json");
  if (unknown !== undefined) {
    log(`unknown doctor argument: ${unknown} (only --json is supported)`);
    return 2;
  }
  const report = await collectDoctorReport(deps);
  if (argv.includes("--json")) {
    log(JSON.stringify(report, undefined, 2));
  } else {
    log(formatDoctorReport(report));
  }
  return report.healthy ? 0 : 1;
}
