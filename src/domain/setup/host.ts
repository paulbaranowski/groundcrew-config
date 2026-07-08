/**
 * What local sandbox tooling a host can run - a pure snapshot derived from the
 * platform string plus which srt-dependency binaries are on PATH. Mirrors
 * groundcrew's own src/lib/host.ts HostCapabilities, scoped to what crew-config
 * reports: safehouse on macOS, the srt runner's deps on Linux.
 */
export interface HostCapabilities {
  platform: string;
  isMacOS: boolean;
  isLinux: boolean;
  /** Safehouse is macOS-only (sandbox-exec / Seatbelt); no Linux port exists. */
  isSafehouseSupported: boolean;
  /** srt (Anthropic sandbox-runtime) runs on macOS and Linux/WSL. */
  isSrtSupported: boolean;
  /** srt's Linux backend deps on PATH. Always false off Linux (see below). */
  hasBubblewrap: boolean;
  hasSocat: boolean;
  hasRipgrep: boolean;
}

/** One srt Linux dependency: the binary to probe and its human/package label. */
export interface SrtDep {
  /** Executable name on PATH. */
  bin: string;
  /** Name shown to the user and used in the apt package list. */
  label: string;
}

/**
 * srt's Linux backend: bubblewrap (the sandbox), socat (proxy plumbing), and
 * ripgrep (file scanning). Order is load-bearing: the missing-deps list and
 * every rendered row follow it.
 */
export const SRT_LINUX_DEPS: readonly SrtDep[] = [
  { bin: "bwrap", label: "bubblewrap" },
  { bin: "socat", label: "socat" },
  { bin: "rg", label: "ripgrep (rg)" },
];

/** Debian/Ubuntu one-liner to install the srt Linux deps. */
export const SRT_APT_INSTALL = "apt install bubblewrap socat ripgrep";

/** Ubuntu 24.04+ restricts unprivileged user namespaces, which bubblewrap needs. */
export const SRT_APPARMOR_NOTE =
  "On Ubuntu 24.04+ also run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0";

/** Which srt-dep binaries are on PATH (true = present); passed to deriveCapabilities. */
export interface PresentBinaries {
  bwrap: boolean;
  socat: boolean;
  rg: boolean;
}

/**
 * Derive the capability snapshot. The Linux dep flags are AND-ed with isLinux so
 * a macOS probe (where bwrap/socat/rg may coincidentally exist for other reasons)
 * never lights up a Linux-only readiness row.
 */
export function deriveCapabilities(
  platform: string,
  present: PresentBinaries,
): HostCapabilities {
  const isMacOS = platform === "darwin";
  const isLinux = platform === "linux";
  return {
    platform,
    isMacOS,
    isLinux,
    isSafehouseSupported: isMacOS,
    isSrtSupported: isMacOS || isLinux,
    hasBubblewrap: isLinux && present.bwrap,
    hasSocat: isLinux && present.socat,
    hasRipgrep: isLinux && present.rg,
  };
}

/** Which of bubblewrap/socat/ripgrep the srt Linux backend is missing. */
export interface SrtReadiness {
  ready: boolean;
  /** Human labels of the missing deps, in SRT_LINUX_DEPS order. */
  missing: string[];
}

/**
 * srt Linux readiness. Off Linux, srt uses sandbox-exec and needs no extra
 * deps, so readiness is trivially true - callers never show a deps row there.
 */
export function computeSrtReadiness(caps: HostCapabilities): SrtReadiness {
  if (!caps.isLinux) return { ready: true, missing: [] };
  const present: Record<string, boolean> = {
    bwrap: caps.hasBubblewrap,
    socat: caps.hasSocat,
    rg: caps.hasRipgrep,
  };
  const missing = SRT_LINUX_DEPS.filter((d) => !present[d.bin]).map(
    (d) => d.label,
  );
  return { ready: missing.length === 0, missing };
}

/** One-line install guidance for the missing srt Linux deps, or "" when ready. */
export function srtGuidance(readiness: SrtReadiness): string {
  if (readiness.ready) return "";
  return `${readiness.missing.join(", ")} not found - Debian/Ubuntu: ${SRT_APT_INSTALL}. ${SRT_APPARMOR_NOTE}`;
}
