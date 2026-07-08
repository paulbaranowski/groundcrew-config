import {
  deriveCapabilities,
  type HostCapabilities,
} from "../../domain/setup/host.ts";
import { which } from "./exec.ts";

/**
 * Injectable seam for host detection: the platform string and a `which` probe.
 * Tests derive Linux capabilities on a macOS host by faking both.
 */
export interface HostDeps {
  platform: string;
  which: (cmd: string) => string | null;
}

export function defaultHostDeps(): HostDeps {
  return { platform: process.platform, which };
}

/**
 * Snapshot the current host's sandbox capabilities. Synchronous: `which` is a
 * PATH stat, cheap enough to run inline in the Setup screen and re-run on a
 * manual re-check. Off Linux the dep probes are skipped by deriveCapabilities.
 */
export function detectHostCapabilities(
  deps: HostDeps = defaultHostDeps(),
): HostCapabilities {
  return deriveCapabilities(deps.platform, {
    bwrap: deps.which("bwrap") !== null,
    socat: deps.which("socat") !== null,
    rg: deps.which("rg") !== null,
  });
}
