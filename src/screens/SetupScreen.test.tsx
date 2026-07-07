import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { InstallReport } from "../io/setup/installs.ts";
import { SetupScreen, type SetupScreenDeps } from "./SetupScreen.tsx";

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

function stubDeps(overrides: Partial<SetupScreenDeps> = {}): SetupScreenDeps {
  return {
    platform: "darwin",
    probeGroundcrew: () => Promise.resolve(installed("4.43.2")),
    installGroundcrew: () => Promise.resolve(installed("4.43.2")),
    probeSafehouse: () => Promise.resolve(missing),
    installSafehouse: () =>
      Promise.resolve({ action: "installed", version: "0.9.0", details: "" }),
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
    // Both enters land in the same input batch, before any re-render: the
    // second must see the acting state via the ref mirror, not the stale
    // render closure.
    stdin.write("\r\r");
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

  it("marks safehouse not applicable off macOS", async () => {
    const { lastFrame } = render(
      <SetupScreen onBack={() => {}} deps={stubDeps({ platform: "linux" })} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("not applicable"));
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
