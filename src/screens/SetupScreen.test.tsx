import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { HostCapabilities } from "../domain/setup/host.ts";
import type { InstallReport } from "../io/setup/installs.ts";
import { SetupScreen, type SetupScreenDeps } from "./SetupScreen.tsx";

const macOSCaps: HostCapabilities = {
  platform: "darwin",
  isMacOS: true,
  isLinux: false,
  isSafehouseSupported: true,
  isSrtSupported: true,
  hasBubblewrap: false,
  hasSocat: false,
  hasRipgrep: false,
};

const linuxReadyCaps: HostCapabilities = {
  platform: "linux",
  isMacOS: false,
  isLinux: true,
  isSafehouseSupported: false,
  isSrtSupported: true,
  hasBubblewrap: true,
  hasSocat: true,
  hasRipgrep: true,
};

const linuxMissingCaps: HostCapabilities = {
  ...linuxReadyCaps,
  hasBubblewrap: false,
  hasSocat: false,
  hasRipgrep: false,
};

const installed = (version: string): InstallReport => ({
  action: "already-installed",
  version,
  details: "",
});
const missing: InstallReport = {
  action: "missing",
  version: null,
  details: "",
};

const healthyClearance = {
  personalFileExists: true,
  personalFileHasClaudeHosts: true,
  envExported: true,
  daemonPid: null,
  daemonAgeSeconds: null,
};

const emptyClearance = {
  personalFileExists: false,
  personalFileHasClaudeHosts: false,
  envExported: false,
  daemonPid: null,
  daemonAgeSeconds: null,
};

const emptySafehouseSetup = {
  binaryAvailable: false,
  binaryPath: null,
  brewFormulaInstalled: false,
  envExported: false,
  sidecarPresent: false,
  sidecarHasFunctions: false,
};

function stubDeps(overrides: Partial<SetupScreenDeps> = {}): SetupScreenDeps {
  return {
    detectHost: () => macOSCaps,
    probeGroundcrew: () => Promise.resolve(installed("4.43.2")),
    installGroundcrew: () => Promise.resolve(installed("4.43.2")),
    probeSafehouse: () => Promise.resolve(missing),
    installSafehouse: () =>
      Promise.resolve({ action: "installed", version: "0.9.0", details: "" }),
    probeClearance: () => Promise.resolve(emptyClearance),
    probeSafehouseSetup: () => Promise.resolve(emptySafehouseSetup),
    writeHosts: vi.fn(() => ({
      target: "/h/.config/clearance/personal-allow-hosts",
      wrote: true,
      refused: false,
    })),
    writeClearance: vi.fn(() => ({
      target: "/h/.config/clearance/env.sh",
      rcConflicts: [],
      overridesStub: null,
    })),
    writeSafehouse: vi.fn(() => ({
      target: "/h/.config/agent-safehouse/env.sh",
      rcConflicts: [],
      overridesStub: null,
    })),
    runCrewDoctor: () =>
      Promise.resolve({ available: true, code: 0, output: "all good" }),
    ...overrides,
  };
}

describe("SetupScreen", () => {
  it("shows probe results for both install rows", async () => {
    const { lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={stubDeps()} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("4.43.2");
      expect(lastFrame()).toContain("not installed");
    });
  });

  it("runs the install action on enter and shows the outcome", async () => {
    const deps = stubDeps();
    const installSpy = vi.fn(deps.installSafehouse);
    deps.installSafehouse = installSpy;
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("not installed"));
    // Move to the safehouse row (second row), then enter.
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ safehouse"));
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(installSpy).toHaveBeenCalledOnce();
      expect(lastFrame()).toContain("0.9.0");
    });
  });

  it("runs a single install for a burst of enter presses in one tick", async () => {
    const deps = stubDeps();
    let resolveInstall: (r: InstallReport) => void = () => {};
    const installSpy = vi.fn(
      () =>
        new Promise<InstallReport>((resolve) => {
          resolveInstall = resolve;
        }),
    );
    deps.installSafehouse = installSpy;
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("not installed"));
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ safehouse"));
    // Both enters land in the same tick, before any re-render: the second
    // must see the acting state via the ref mirror, not the stale render
    // closure. (Two separate writes: a fused "\r\r" chunk is not parsed as
    // two return keypresses by ink.)
    stdin.write("\r");
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("installing…"));
    expect(installSpy).toHaveBeenCalledOnce();
    resolveInstall({ action: "installed", version: "0.9.0", details: "" });
    await vi.waitFor(() => expect(lastFrame()).toContain("0.9.0"));
  });

  it("does not re-run an install on an already-installed row", async () => {
    const deps = stubDeps();
    const installSpy = vi.fn(deps.installGroundcrew);
    deps.installGroundcrew = installSpy;
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("4.43.2"));
    stdin.write("\r"); // cursor starts on the groundcrew row
    // Explicit user action is required for mutations, and an installed row
    // offers none.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(installSpy).not.toHaveBeenCalled();
  });

  it("does not show a safehouse row on Linux (srt sandbox row instead)", async () => {
    const { lastFrame } = render(
      <SetupScreen
        onBack={() => {}}
        deps={stubDeps({ detectHost: () => linuxReadyCaps })}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("srt sandbox"));
    // No safehouse install row or safehouse-sidecar row on Linux (the
    // RC_SNIPPET's static "agent-safehouse" mention is unrelated to rows).
    expect(lastFrame()).not.toContain("brew eugene1g");
    expect(lastFrame()).not.toContain("safehouse env.sh");
  });

  it("shows an srt sandbox row (not safehouse) on Linux", async () => {
    const { lastFrame } = render(
      <SetupScreen
        onBack={() => {}}
        deps={stubDeps({ detectHost: () => linuxMissingCaps })}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("srt sandbox");
      expect(lastFrame()).toContain("bubblewrap");
    });
    // The macOS-only rows are absent on Linux.
    expect(lastFrame()).not.toContain("brew eugene1g");
  });

  it("shows srt ready when the Linux deps are present", async () => {
    const { lastFrame } = render(
      <SetupScreen
        onBack={() => {}}
        deps={stubDeps({ detectHost: () => linuxReadyCaps })}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("srt sandbox"));
    expect(lastFrame()).toContain("ready ✓");
  });

  it("re-probes the host when Enter is pressed on the srt row", async () => {
    let caps = linuxMissingCaps;
    const detectHost = vi.fn(() => caps);
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={stubDeps({ detectHost })} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("srt sandbox"));
    // srt is the SECOND row on Linux (after groundcrew): move down once.
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ srt sandbox"));
    // The user installs the deps out of band; the next re-check sees them.
    caps = linuxReadyCaps;
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("ready ✓"));
    expect(detectHost.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("degrades a failed probe to a failed row instead of crashing", async () => {
    const deps = stubDeps({
      probeGroundcrew: () =>
        Promise.resolve({
          action: "failed",
          version: null,
          details:
            "npm not found on PATH - install Node.js from https://nodejs.org",
        }),
    });
    const { lastFrame } = render(<SetupScreen onBack={() => {}} deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain("npm not found"));
  });

  it("enter on a failed row re-probes it instead of dead-ending", async () => {
    const failed: InstallReport = {
      action: "failed",
      version: null,
      details: "timed out after 30000ms",
    };
    const deps = stubDeps();
    let probes = 0;
    deps.probeGroundcrew = vi.fn(() => {
      probes += 1;
      return Promise.resolve(probes === 1 ? failed : missing);
    });
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("enter to retry"));
    stdin.write("\r"); // cursor starts on the groundcrew row
    // The retry is a fresh probe (read-only), whose result replaces the row.
    await vi.waitFor(() => {
      expect(deps.probeGroundcrew).toHaveBeenCalledTimes(2);
      expect(lastFrame()).toContain("not installed - enter to install");
    });
  });

  it("esc calls onBack", async () => {
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={onBack} deps={stubDeps()} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("Setup"));
    stdin.write("\u001B");
    await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
  });
});

describe("SetupScreen sidecar rows", () => {
  it("shows missing clearance artifacts as fixable rows", async () => {
    const { lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={stubDeps()} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("clearance hosts");
      expect(lastFrame()).toContain("clearance env.sh");
      expect(lastFrame()).toContain("safehouse env.sh");
    });
  });

  it("writes the sidecar on enter and re-probes the row", async () => {
    const deps = stubDeps();
    let clearanceState = emptyClearance;
    deps.probeClearance = () => Promise.resolve(clearanceState);
    deps.writeClearance = vi.fn(() => {
      clearanceState = healthyClearance;
      return {
        target: "/h/.config/clearance/env.sh",
        rcConflicts: [],
        overridesStub: null,
      };
    });
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("clearance env.sh"));
    // Navigate to the clearance env.sh row (4th row: groundcrew, safehouse,
    // clearance hosts, clearance env.sh), then enter.
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ safehouse"));
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ clearance hosts"));
    stdin.write("\u001B[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ clearance env.sh"));
    stdin.write("\r");
    await vi.waitFor(() => expect(deps.writeClearance).toHaveBeenCalledOnce());
  });

  it("always shows the rc snippet instruction (N3: user adds it themselves)", async () => {
    const { lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={stubDeps()} />,
    );
    await vi.waitFor(() =>
      expect(lastFrame()).toContain("Add this line to your shell rc"),
    );
  });

  it("runs crew doctor from the final row and shows its output", async () => {
    const deps = stubDeps();
    deps.runCrewDoctor = vi.fn(() =>
      Promise.resolve({
        available: true,
        code: 0,
        output: "everything is fine",
      }),
    );
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("run crew doctor"));
    // Walk down row by row, awaiting each cursor move so a keystroke is
    // never sent before the previous re-render settled.
    for (const label of [
      "▸ safehouse",
      "▸ clearance hosts",
      "▸ clearance env.sh",
      "▸ safehouse env.sh",
      "▸ run crew doctor",
    ]) {
      stdin.write("\u001B[B");
      await vi.waitFor(() => expect(lastFrame()).toContain(label));
    }
    stdin.write("\r");
    await vi.waitFor(() => {
      expect(deps.runCrewDoctor).toHaveBeenCalledOnce();
      expect(lastFrame()).toContain("everything is fine");
    });
    // Any key closes the output view.
    stdin.write("x");
    await vi.waitFor(() => expect(lastFrame()).toContain("Setup"));
  });

  it("reports an rc-owned wrapper as rc-defined, not broken", async () => {
    const deps = stubDeps({
      probeSafehouseSetup: () =>
        Promise.resolve({
          ...emptySafehouseSetup,
          sidecarPresent: true,
          sidecarHasFunctions: false,
        }),
    });
    deps.writeSafehouse = vi.fn(() => ({
      target: "/h/.config/agent-safehouse/env.sh",
      rcConflicts: [{ item: "safe", file: "/h/.zshrc", line: 3, value: null }],
      overridesStub: null,
    }));
    const { stdin, lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={deps} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("safehouse env.sh"));
    // Navigate to the safehouse env.sh row (5th) and regenerate.
    for (const label of [
      "▸ safehouse",
      "▸ clearance hosts",
      "▸ clearance env.sh",
      "▸ safehouse env.sh",
    ]) {
      stdin.write("\u001B[B");
      await vi.waitFor(() => expect(lastFrame()).toContain(label));
    }
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("defined in your rc"));
  });
});

// N4 ("no action off macOS" for the safehouse sidecar) previously had its own
// describe block here. On Linux the safehouse and safehouse-sidecar rows are
// now dropped entirely (buildRows), not merely marked "not applicable", so
// there is no row left to navigate to or press enter on; there is nothing
// left for the safehouseSidecar write to no-op against from the UI. This is
// covered instead by "does not show a safehouse row on Linux" above. The
// `!host0.isSafehouseSupported` guard in activateSidecar remains as
// defense-in-depth (see SetupScreen.tsx) but is unreachable via input once
// the row is gone.
