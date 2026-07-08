import { describe, expect, it } from "vitest";
import {
  computeSrtReadiness,
  deriveCapabilities,
  srtGuidance,
  SRT_APT_INSTALL,
  SRT_LINUX_DEPS,
} from "./host.ts";

const allPresent = { bwrap: true, socat: true, rg: true };
const nonePresent = { bwrap: false, socat: false, rg: false };

describe("deriveCapabilities", () => {
  it("marks macOS: safehouse and srt supported, Linux deps forced false", () => {
    const caps = deriveCapabilities("darwin", allPresent);
    expect(caps.isMacOS).toBe(true);
    expect(caps.isLinux).toBe(false);
    expect(caps.isSafehouseSupported).toBe(true);
    expect(caps.isSrtSupported).toBe(true);
    // Off Linux the dep probes are irrelevant and must not leak true.
    expect(caps.hasBubblewrap).toBe(false);
    expect(caps.hasSocat).toBe(false);
    expect(caps.hasRipgrep).toBe(false);
  });

  it("marks Linux: srt supported, safehouse not, deps reflect PATH", () => {
    const caps = deriveCapabilities("linux", {
      bwrap: true,
      socat: false,
      rg: true,
    });
    expect(caps.isLinux).toBe(true);
    expect(caps.isSafehouseSupported).toBe(false);
    expect(caps.isSrtSupported).toBe(true);
    expect(caps.hasBubblewrap).toBe(true);
    expect(caps.hasSocat).toBe(false);
    expect(caps.hasRipgrep).toBe(true);
  });

  it("marks an exotic platform as neither sandbox supported", () => {
    const caps = deriveCapabilities("win32", allPresent);
    expect(caps.isSafehouseSupported).toBe(false);
    expect(caps.isSrtSupported).toBe(false);
  });
});

describe("computeSrtReadiness", () => {
  it("is trivially ready off Linux (macOS srt needs no extra deps)", () => {
    const r = computeSrtReadiness(deriveCapabilities("darwin", nonePresent));
    expect(r).toEqual({ ready: true, missing: [] });
  });

  it("is ready on Linux when all three deps are present", () => {
    const r = computeSrtReadiness(deriveCapabilities("linux", allPresent));
    expect(r).toEqual({ ready: true, missing: [] });
  });

  it("lists missing deps in SRT_LINUX_DEPS order", () => {
    const r = computeSrtReadiness(
      deriveCapabilities("linux", { bwrap: false, socat: true, rg: false }),
    );
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["bubblewrap", "ripgrep (rg)"]);
  });
});

describe("srtGuidance", () => {
  it("is empty when ready", () => {
    expect(srtGuidance({ ready: true, missing: [] })).toBe("");
  });

  it("names the missing deps and the apt install line plus apparmor note", () => {
    const g = srtGuidance({ ready: false, missing: ["bubblewrap", "socat"] });
    expect(g).toContain("bubblewrap, socat");
    expect(g).toContain(SRT_APT_INSTALL);
    expect(g).toContain("kernel.apparmor_restrict_unprivileged_userns=0");
    expect(g).not.toContain("—");
  });
});

describe("SRT_LINUX_DEPS", () => {
  it("probes bwrap/socat/rg with human labels", () => {
    expect(SRT_LINUX_DEPS.map((d) => d.bin)).toEqual(["bwrap", "socat", "rg"]);
    expect(SRT_LINUX_DEPS.map((d) => d.label)).toEqual([
      "bubblewrap",
      "socat",
      "ripgrep (rg)",
    ]);
  });
});
