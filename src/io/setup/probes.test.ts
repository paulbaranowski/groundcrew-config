import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { InstallDeps } from "./installs.ts";
import { probeClearance, probeSafehouse } from "./probes.ts";

function tempHome(): string {
  return mkdtempSync(path.join(tmpdir(), "probes-home-"));
}

function writeHomeFile(home: string, relative: string, content: string): void {
  const target = path.join(home, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

// env defaults to {} in every test so the real shell's CLEARANCE_/SAFEHOUSE_
// vars can never leak in and flip envExported.
describe("probeClearance", () => {
  it("reports all-false/null for an empty home", () => {
    expect(probeClearance(tempHome(), {})).toEqual({
      personalFileExists: false,
      personalFileHasClaudeHosts: false,
      envExported: false,
      daemonPid: null,
      daemonAgeSeconds: null,
    });
  });

  it("detects the personal file and its uncommented claude host", () => {
    const home = tempHome();
    writeHomeFile(
      home,
      ".config/clearance/personal-allow-hosts",
      "# comment\ndownloads.claude.ai\n",
    );
    const status = probeClearance(home, {});
    expect(status.personalFileExists).toBe(true);
    expect(status.personalFileHasClaudeHosts).toBe(true);
  });

  it("does not count a commented-out claude host", () => {
    const home = tempHome();
    writeHomeFile(
      home,
      ".config/clearance/personal-allow-hosts",
      "#downloads.claude.ai\n",
    );
    const status = probeClearance(home, {});
    expect(status.personalFileExists).toBe(true);
    expect(status.personalFileHasClaudeHosts).toBe(false);
  });

  it("reports envExported from the live process env", () => {
    const home = tempHome();
    const status = probeClearance(home, {
      CLEARANCE_ALLOW_HOSTS_FILES: "/some/file",
    });
    expect(status.envExported).toBe(true);
  });

  it("falls back to an anchored rc scan for envExported", () => {
    const home = tempHome();
    writeHomeFile(home, ".zshrc", "export CLEARANCE_ALLOW_HOSTS_FILES=/x\n");
    expect(probeClearance(home, {}).envExported).toBe(true);
    // Mentions do not count.
    writeHomeFile(home, ".zshrc", 'echo "CLEARANCE_ALLOW_HOSTS_FILES"\n');
    expect(probeClearance(home, {}).envExported).toBe(false);
  });

  it("reports a live daemon pid and a fresh age from the pid file", () => {
    const home = tempHome();
    writeHomeFile(home, ".cache/clearance/clearance.pid", `${process.pid}\n`);
    const status = probeClearance(home, {});
    expect(status.daemonPid).toBe(process.pid);
    expect(status.daemonAgeSeconds).toBeGreaterThanOrEqual(0);
    expect(status.daemonAgeSeconds).toBeLessThan(60);
  });

  it("reports null pid for garbage pid-file content but still reports age", () => {
    const home = tempHome();
    writeHomeFile(home, ".cache/clearance/clearance.pid", "not-a-pid\n");
    const status = probeClearance(home, {});
    expect(status.daemonPid).toBeNull();
    expect(status.daemonAgeSeconds).not.toBeNull();
  });
});

describe("probeSafehouse", () => {
  const formulaMissing: InstallDeps = {
    run: () => Promise.resolve({ code: 1, stdout: "", stderr: "" }),
    which: () => null,
  };

  it("reports all-false for an empty home with nothing installed", async () => {
    const status = await probeSafehouse(tempHome(), {}, formulaMissing);
    expect(status).toEqual({
      binaryAvailable: false,
      binaryPath: null,
      brewFormulaInstalled: false,
      envExported: false,
      sidecarPresent: false,
      sidecarHasFunctions: false,
    });
  });

  it("detects the sidecar and both wrapper functions", async () => {
    const home = tempHome();
    writeHomeFile(
      home,
      ".config/agent-safehouse/env.sh",
      "export SAFEHOUSE_APPEND_PROFILE=/x\nsafe() {\n :\n}\nsafe-claude() {\n :\n}\n",
    );
    const status = await probeSafehouse(home, {}, formulaMissing);
    expect(status.sidecarPresent).toBe(true);
    expect(status.sidecarHasFunctions).toBe(true);
  });

  it("reports sidecarHasFunctions false when only safe() is defined", async () => {
    const home = tempHome();
    writeHomeFile(home, ".config/agent-safehouse/env.sh", "safe() { :; }\n");
    const status = await probeSafehouse(home, {}, formulaMissing);
    expect(status.sidecarPresent).toBe(true);
    expect(status.sidecarHasFunctions).toBe(false);
  });

  it("reports the safehouse binary via the injected which", async () => {
    const deps: InstallDeps = {
      ...formulaMissing,
      which: (cmd) => (cmd === "safehouse" ? "/opt/bin/safehouse" : null),
    };
    const status = await probeSafehouse(tempHome(), {}, deps);
    expect(status.binaryAvailable).toBe(true);
    expect(status.binaryPath).toBe("/opt/bin/safehouse");
  });

  it("reports brewFormulaInstalled from the formula probe", async () => {
    const deps: InstallDeps = {
      run: () =>
        Promise.resolve({
          code: 0,
          stdout: "agent-safehouse 0.9.0",
          stderr: "",
        }),
      which: (cmd) => (cmd === "brew" ? "/opt/homebrew/bin/brew" : null),
    };
    const status = await probeSafehouse(tempHome(), {}, deps);
    expect(status.brewFormulaInstalled).toBe(true);
  });

  it("reports envExported from the live env or the rc scan", async () => {
    const home = tempHome();
    expect(
      (
        await probeSafehouse(
          home,
          { SAFEHOUSE_APPEND_PROFILE: "/x" },
          formulaMissing,
        )
      ).envExported,
    ).toBe(true);
    writeHomeFile(
      home,
      ".bash_profile",
      "export SAFEHOUSE_APPEND_PROFILE=/y\n",
    );
    expect((await probeSafehouse(home, {}, formulaMissing)).envExported).toBe(
      true,
    );
  });
});
