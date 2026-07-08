import { describe, expect, it } from "vitest";
import { GROUNDCREW_PACKAGE } from "../../domain/setup/installProbe.ts";
import type { ExecResult } from "./exec.ts";
import {
  installGroundcrew,
  installSafehouse,
  probeGroundcrew,
  probeSafehouseFormula,
  type InstallDeps,
} from "./installs.ts";

interface Call {
  cmd: string;
  args: string[];
}

function fakeDeps(
  respond: (cmd: string, args: string[]) => ExecResult,
  options: { hasNpm?: boolean; hasBrew?: boolean } = {},
): { deps: InstallDeps; calls: Call[] } {
  const calls: Call[] = [];
  const { hasNpm = true, hasBrew = true } = options;
  return {
    calls,
    deps: {
      run: (cmd, args) => {
        calls.push({ cmd, args });
        return Promise.resolve(respond(cmd, args));
      },
      which: (cmd) =>
        (cmd === "npm" && hasNpm) || (cmd === "brew" && hasBrew)
          ? `/usr/local/bin/${cmd}`
          : null,
    },
  };
}

const installedNpmLs: ExecResult = {
  code: 0,
  stdout: JSON.stringify({
    dependencies: { [GROUNDCREW_PACKAGE]: { version: "4.43.2" } },
  }),
  stderr: "",
};

// npm ls exits 1 when the package is missing, but the JSON body is valid.
const missingNpmLs: ExecResult = {
  code: 1,
  stdout: JSON.stringify({ dependencies: {} }),
  stderr: "",
};

describe("probeGroundcrew", () => {
  it("fails with guidance when npm is not on PATH", async () => {
    const { deps, calls } = fakeDeps(() => installedNpmLs, { hasNpm: false });
    const report = await probeGroundcrew(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("npm not found");
    expect(calls).toHaveLength(0);
  });

  it("reports already-installed with the version", async () => {
    const { deps } = fakeDeps(() => installedNpmLs);
    expect(await probeGroundcrew(deps)).toEqual({
      action: "already-installed",
      version: "4.43.2",
      details: "",
    });
  });

  it("reports missing despite npm ls exiting non-zero", async () => {
    const { deps } = fakeDeps(() => missingNpmLs);
    expect((await probeGroundcrew(deps)).action).toBe("missing");
  });

  it("reports failed, not missing, when the probe itself times out", async () => {
    const { deps } = fakeDeps(() => ({
      code: -1,
      stdout: "",
      stderr: "",
      error: "timed out after 30000ms",
    }));
    const report = await probeGroundcrew(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("timed out");
  });
});

describe("installGroundcrew", () => {
  it("is a no-op on an already-installed system", async () => {
    const { deps, calls } = fakeDeps(() => installedNpmLs);
    const report = await installGroundcrew(deps);
    expect(report.action).toBe("already-installed");
    // Only the probe ran; no `npm install` call was made.
    expect(calls.map((c) => c.args[0])).toEqual(["ls"]);
  });

  it("installs when missing, then re-probes for the new version", async () => {
    let installed = false;
    const { deps, calls } = fakeDeps((_cmd, args) => {
      if (args[0] === "install") {
        installed = true;
        return { code: 0, stdout: "", stderr: "" };
      }
      return installed ? installedNpmLs : missingNpmLs;
    });
    const report = await installGroundcrew(deps);
    expect(report).toEqual({
      action: "installed",
      version: "4.43.2",
      details: "",
    });
    expect(calls.map((c) => c.args[0])).toEqual(["ls", "install", "ls"]);
    expect(calls[1]!.args).toEqual(["install", "-g", GROUNDCREW_PACKAGE]);
  });

  it("reports failed with stderr details when the install exits non-zero", async () => {
    const { deps } = fakeDeps((_cmd, args) =>
      args[0] === "install"
        ? { code: 7, stdout: "", stderr: "EACCES: permission denied" }
        : missingNpmLs,
    );
    const report = await installGroundcrew(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("EACCES");
  });

  it("reports failed when install exits 0 but the re-probe still can't see the package", async () => {
    const { deps } = fakeDeps((_cmd, args) =>
      args[0] === "install"
        ? { code: 0, stdout: "", stderr: "" }
        : missingNpmLs,
    );
    const report = await installGroundcrew(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("still not detected");
  });
});

describe("probeSafehouseFormula", () => {
  it("fails with guidance when brew is not on PATH", async () => {
    const { deps } = fakeDeps(() => ({ code: 0, stdout: "", stderr: "" }), {
      hasBrew: false,
    });
    const report = await probeSafehouseFormula(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("brew not found");
  });

  it("reports missing when brew list exits non-zero", async () => {
    const { deps } = fakeDeps(() => ({ code: 1, stdout: "", stderr: "" }));
    expect((await probeSafehouseFormula(deps)).action).toBe("missing");
  });

  it("reports already-installed with the version", async () => {
    const { deps } = fakeDeps(() => ({
      code: 0,
      stdout: "agent-safehouse 0.9.0\n",
      stderr: "",
    }));
    expect(await probeSafehouseFormula(deps)).toEqual({
      action: "already-installed",
      version: "0.9.0",
      details: "",
    });
  });

  it("reports failed, not missing, when the probe itself fails to spawn", async () => {
    const { deps } = fakeDeps(() => ({
      code: -1,
      stdout: "",
      stderr: "",
      error: "ENOENT",
    }));
    const report = await probeSafehouseFormula(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("ENOENT");
  });
});

describe("installSafehouse", () => {
  it("installs via the fully-qualified tap ref (auto-taps on first use)", async () => {
    let installed = false;
    const { deps, calls } = fakeDeps((_cmd, args) => {
      if (args[0] === "install") {
        installed = true;
        return { code: 0, stdout: "", stderr: "" };
      }
      return installed
        ? { code: 0, stdout: "agent-safehouse 0.9.0", stderr: "" }
        : { code: 1, stdout: "", stderr: "" };
    });
    const report = await installSafehouse(deps);
    expect(report.action).toBe("installed");
    expect(report.version).toBe("0.9.0");
    expect(calls[1]!.args).toEqual([
      "install",
      "eugene1g/safehouse/agent-safehouse",
    ]);
  });

  it("reports failed when the spawn itself fails", async () => {
    const { deps } = fakeDeps((_cmd, args) =>
      args[0] === "install"
        ? {
            code: -1,
            stdout: "",
            stderr: "",
            error: "timed out after 600000ms",
          }
        : { code: 1, stdout: "", stderr: "" },
    );
    const report = await installSafehouse(deps);
    expect(report.action).toBe("failed");
    expect(report.details).toContain("timed out");
  });
});
