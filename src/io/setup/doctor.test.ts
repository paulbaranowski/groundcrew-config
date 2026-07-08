import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { InstallReport } from "./installs.ts";
import {
  collectDoctorReport,
  formatDoctorReport,
  isHealthy,
  runDoctor,
  type DoctorDeps,
  type DoctorReport,
} from "./doctor.ts";

const healthyClearance = {
  personalFileExists: true,
  personalFileHasClaudeHosts: true,
  envExported: true,
  daemonPid: 123,
  daemonAgeSeconds: 10,
};

const healthySafehouse = {
  binaryAvailable: true,
  binaryPath: "/opt/bin/safehouse",
  brewFormulaInstalled: true,
  envExported: true,
  sidecarPresent: true,
  sidecarHasFunctions: true,
};

const installedGroundcrew: InstallReport = {
  action: "already-installed",
  version: "4.43.2",
  details: "",
};

describe("isHealthy", () => {
  it("is healthy when groundcrew is installed and both setups are complete", () => {
    expect(
      isHealthy({
        platform: "darwin",
        groundcrew: installedGroundcrew,
        clearance: healthyClearance,
        safehouse: healthySafehouse,
        srt: null,
      }),
    ).toBe(true);
  });

  it("is broken when groundcrew is missing", () => {
    expect(
      isHealthy({
        platform: "darwin",
        groundcrew: { action: "missing", version: null, details: "" },
        clearance: healthyClearance,
        safehouse: healthySafehouse,
        srt: null,
      }),
    ).toBe(false);
  });

  it("is broken when a clearance artifact is absent", () => {
    expect(
      isHealthy({
        platform: "darwin",
        groundcrew: installedGroundcrew,
        clearance: { ...healthyClearance, personalFileHasClaudeHosts: false },
        safehouse: healthySafehouse,
        srt: null,
      }),
    ).toBe(false);
  });

  // Daemon staleness is informational, not a health gate: the daemon starts
  // on demand when crew runs.
  it("stays healthy with no daemon pid", () => {
    expect(
      isHealthy({
        platform: "darwin",
        groundcrew: installedGroundcrew,
        clearance: {
          ...healthyClearance,
          daemonPid: null,
          daemonAgeSeconds: null,
        },
        safehouse: healthySafehouse,
        srt: null,
      }),
    ).toBe(true);
  });

  it("ignores safehouse entirely when it is not applicable (non-macOS)", () => {
    expect(
      isHealthy({
        platform: "linux",
        groundcrew: installedGroundcrew,
        clearance: healthyClearance,
        safehouse: null,
        srt: null,
      }),
    ).toBe(true);
  });

  it("is broken when a safehouse field is false on macOS", () => {
    expect(
      isHealthy({
        platform: "darwin",
        groundcrew: installedGroundcrew,
        clearance: healthyClearance,
        safehouse: { ...healthySafehouse, sidecarHasFunctions: false },
        srt: null,
      }),
    ).toBe(false);
  });

  it("stays healthy on Linux when srt deps are missing (informational only)", () => {
    expect(
      isHealthy({
        platform: "linux",
        groundcrew: installedGroundcrew,
        clearance: healthyClearance,
        safehouse: null,
        srt: { supported: true, ready: false, missing: ["bubblewrap"] },
      }),
    ).toBe(true);
  });
});

function emptyHomeDeps(platform: string): DoctorDeps {
  return {
    home: mkdtempSync(path.join(tmpdir(), "doctor-home-")),
    platform,
    env: {},
    installDeps: {
      // npm ls "missing" shape; brew list exits non-zero.
      run: (cmd) =>
        Promise.resolve(
          cmd === "npm"
            ? { code: 1, stdout: '{"dependencies":{}}', stderr: "" }
            : { code: 1, stdout: "", stderr: "" },
        ),
      which: (cmd) => (cmd === "npm" || cmd === "brew" ? `/bin/${cmd}` : null),
    },
  };
}

describe("collectDoctorReport", () => {
  it("skips safehouse probing off macOS", async () => {
    const report = await collectDoctorReport(emptyHomeDeps("linux"));
    expect(report.safehouse).toBeNull();
    expect(report.groundcrew.action).toBe("missing");
    expect(report.healthy).toBe(false);
  });

  it("includes safehouse on macOS", async () => {
    const report = await collectDoctorReport(emptyHomeDeps("darwin"));
    expect(report.safehouse).not.toBeNull();
    expect(report.safehouse!.brewFormulaInstalled).toBe(false);
  });

  it("reports srt (not safehouse) on Linux with missing deps listed", async () => {
    const report = await collectDoctorReport(emptyHomeDeps("linux"));
    expect(report.safehouse).toBeNull();
    expect(report.srt).not.toBeNull();
    expect(report.srt!.supported).toBe(true);
    expect(report.srt!.ready).toBe(false);
    expect(report.srt!.missing).toEqual(["bubblewrap", "socat", "ripgrep (rg)"]);
    // srt readiness must NOT gate health (LI2): missing deps alone stay non-fatal.
    // (groundcrew is also missing here, so healthy is false for that reason;
    // the srt-specific assertion is that missing deps did not ADD a gate.)
  });

  it("has srt ready on a Linux host with the deps on PATH", async () => {
    const base = emptyHomeDeps("linux");
    const deps: DoctorDeps = {
      ...base,
      installDeps: {
        ...base.installDeps,
        which: (cmd) =>
          ["npm", "brew", "bwrap", "socat", "rg"].includes(cmd)
            ? `/bin/${cmd}`
            : null,
      },
    };
    const report = await collectDoctorReport(deps);
    expect(report.srt).toEqual({ supported: true, ready: true, missing: [] });
  });

  it("leaves srt null on macOS (safehouse is the macOS story)", async () => {
    const report = await collectDoctorReport(emptyHomeDeps("darwin"));
    expect(report.srt).toBeNull();
    expect(report.safehouse).not.toBeNull();
  });
});

describe("formatDoctorReport", () => {
  const report: DoctorReport = {
    platform: "darwin",
    groundcrew: installedGroundcrew,
    clearance: { ...healthyClearance, daemonPid: null, daemonAgeSeconds: null },
    safehouse: {
      ...healthySafehouse,
      binaryAvailable: false,
      binaryPath: null,
    },
    srt: null,
    healthy: false,
  };

  it("names each area with a pass/fail glyph and the version", () => {
    const text = formatDoctorReport(report);
    expect(text).toContain("groundcrew");
    expect(text).toContain("4.43.2");
    expect(text).toContain("✓");
    expect(text).toContain("✗");
  });

  it("marks safehouse not applicable off macOS", () => {
    const text = formatDoctorReport({
      ...report,
      platform: "linux",
      safehouse: null,
      srt: { supported: true, ready: true, missing: [] },
      healthy: true,
    });
    expect(text).toContain("srt sandbox (Linux)");
  });

  it("renders an srt row on Linux instead of the safehouse rows", () => {
    const text = formatDoctorReport({
      platform: "linux",
      groundcrew: installedGroundcrew,
      clearance: { ...healthyClearance, daemonPid: null, daemonAgeSeconds: null },
      safehouse: null,
      srt: { supported: true, ready: false, missing: ["bubblewrap", "socat"] },
      healthy: true,
    });
    expect(text).toContain("srt sandbox (Linux)");
    expect(text).toContain("apt install bubblewrap socat ripgrep");
    expect(text).not.toContain("safehouse (brew formula)");
  });
});

describe("runDoctor", () => {
  it("prints JSON and exits 1 for a broken machine with --json", async () => {
    const lines: string[] = [];
    const code = await runDoctor(["--json"], emptyHomeDeps("linux"), (l) =>
      lines.push(l),
    );
    expect(code).toBe(1);
    const parsed = JSON.parse(lines.join("\n")) as DoctorReport;
    expect(parsed.groundcrew.action).toBe("missing");
    expect(parsed.healthy).toBe(false);
  });

  it("prints text rows without --json", async () => {
    const lines: string[] = [];
    await runDoctor([], emptyHomeDeps("linux"), (l) => lines.push(l));
    expect(lines.join("\n")).toContain("groundcrew");
  });

  it("rejects unknown arguments loudly with exit code 2", async () => {
    const lines: string[] = [];
    const code = await runDoctor(["--jsn"], emptyHomeDeps("linux"), (l) =>
      lines.push(l),
    );
    expect(code).toBe(2);
    expect(lines.join("\n")).toContain("--jsn");
  });
});
