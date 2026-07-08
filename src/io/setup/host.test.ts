import { describe, expect, it } from "vitest";
import { detectHostCapabilities } from "./host.ts";

// A fake `which` that reports a fixed set of binaries as present.
function whichWith(present: readonly string[]): (cmd: string) => string | null {
  return (cmd) => (present.includes(cmd) ? `/usr/bin/${cmd}` : null);
}

describe("detectHostCapabilities", () => {
  it("reports Linux deps from PATH probes", () => {
    const caps = detectHostCapabilities({
      platform: "linux",
      which: whichWith(["bwrap", "rg"]),
    });
    expect(caps.isLinux).toBe(true);
    expect(caps.hasBubblewrap).toBe(true);
    expect(caps.hasSocat).toBe(false);
    expect(caps.hasRipgrep).toBe(true);
    expect(caps.isSrtSupported).toBe(true);
    expect(caps.isSafehouseSupported).toBe(false);
  });

  it("reports macOS as safehouse-supported with Linux deps forced false", () => {
    const caps = detectHostCapabilities({
      platform: "darwin",
      // Even if these binaries exist on the mac, they must not light up Linux flags.
      which: whichWith(["bwrap", "socat", "rg"]),
    });
    expect(caps.isSafehouseSupported).toBe(true);
    expect(caps.hasBubblewrap).toBe(false);
    expect(caps.hasSocat).toBe(false);
    expect(caps.hasRipgrep).toBe(false);
  });
});
