import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import {
  CLAUDE_HOSTS,
  computeAppendContent,
  HOSTS_DEFAULT_BODY,
  renderClearanceSidecar,
  VAR_ALLOW_HOSTS,
  VAR_PERSONAL,
} from "../../domain/setup/clearance.ts";
import { scanRcContents, type RcMatch } from "../../domain/setup/rcScan.ts";
import {
  FN_SAFE,
  FN_SAFE_CLAUDE,
  OVERRIDES_STUB,
  renderSafehouseSidecar,
  VAR_APPEND_PROFILE,
} from "../../domain/setup/safehouse.ts";
import {
  CLEARANCE_PERSONAL_HOSTS_PATH,
  CLEARANCE_SIDECAR_PATH,
  readRcFiles,
  SAFEHOUSE_OVERRIDES_PATH,
  SAFEHOUSE_SIDECAR_PATH,
} from "./probes.ts";

/**
 * Atomic write (I1): temp file in the target's own directory, fsync, rename
 * over the original. The temp file lives beside the target so the rename is
 * same-filesystem and therefore atomic; a crash mid-write leaves the original
 * untouched.
 */
export function writeAtomic(
  target: string,
  content: string,
  mode = 0o644,
): void {
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomUUID()}.tmp`,
  );
  try {
    const fd = openSync(tmp, "w", mode);
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, target);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
}

export interface HostsWriteResult {
  target: string;
  /** True when file content changed on disk this call. */
  wrote: boolean;
  /** Create mode only: true when an existing file blocked the write. */
  refused: boolean;
}

/**
 * Write or append the clearance personal-allow-hosts file (F3).
 * Create mode refuses to overwrite an existing file (protects hand edits);
 * append mode creates-with-default when absent, else adds only the missing
 * Claude hosts (I2: never duplicates, no-op when complete).
 */
export function writeClearanceHosts(
  home: string,
  mode: "create" | "append",
): HostsWriteResult {
  const target = path.join(home, CLEARANCE_PERSONAL_HOSTS_PATH);
  if (!existsSync(target)) {
    writeAtomic(target, HOSTS_DEFAULT_BODY);
    return { target, wrote: true, refused: false };
  }
  if (mode === "create") {
    return { target, wrote: false, refused: true };
  }
  const existing = readFileSync(target, "utf8");
  const next = computeAppendContent(existing, CLAUDE_HOSTS);
  if (next === existing) {
    return { target, wrote: false, refused: false };
  }
  writeAtomic(target, next);
  return { target, wrote: true, refused: false };
}

export interface SidecarWriteResult {
  target: string;
  rcConflicts: RcMatch[];
  /** Path of a newly-created overrides stub, or null (exists already / not applicable). */
  overridesStub: string | null;
}

/** Render and atomically write ~/.config/clearance/env.sh (F3, F5). */
export function writeClearanceSidecar(home: string): SidecarWriteResult {
  // Conflicts are re-derived from the rc files on every call (I2): stale
  // conflict state can never be baked into a regenerated sidecar.
  const conflicts = scanRcContents(readRcFiles(home), [
    { kind: "export", name: VAR_ALLOW_HOSTS },
    { kind: "export", name: VAR_PERSONAL },
  ]);
  const target = path.join(home, CLEARANCE_SIDECAR_PATH);
  writeAtomic(target, renderClearanceSidecar(conflicts));
  return { target, rcConflicts: [...conflicts.values()], overridesStub: null };
}

/** Render and atomically write ~/.config/agent-safehouse/env.sh + stub (F4, F5). */
export function writeSafehouseSidecar(home: string): SidecarWriteResult {
  const conflicts = scanRcContents(readRcFiles(home), [
    { kind: "export", name: VAR_APPEND_PROFILE },
    { kind: "function", name: FN_SAFE },
    { kind: "function", name: FN_SAFE_CLAUDE },
  ]);
  const overridesPath = path.join(home, SAFEHOUSE_OVERRIDES_PATH);
  const target = path.join(home, SAFEHOUSE_SIDECAR_PATH);
  writeAtomic(target, renderSafehouseSidecar(conflicts, overridesPath));
  let overridesStub: string | null = null;
  if (!existsSync(overridesPath)) {
    // The stub is created once and never regenerated: after creation the
    // user owns it (I2).
    writeAtomic(overridesPath, OVERRIDES_STUB);
    overridesStub = overridesPath;
  }
  return { target, rcConflicts: [...conflicts.values()], overridesStub };
}
