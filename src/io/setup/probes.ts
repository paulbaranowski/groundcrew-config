import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  RC_CANDIDATES,
  scanRcContents,
  type RcFileContent,
} from "../../domain/setup/rcScan.ts";
import {
  defaultInstallDeps,
  probeSafehouseFormula,
  type InstallDeps,
} from "./installs.ts";

/** Home-relative artifact paths, shared with the sidecar writers (PR 2). */
export const CLEARANCE_PERSONAL_HOSTS_PATH =
  ".config/clearance/personal-allow-hosts";
export const CLEARANCE_SIDECAR_PATH = ".config/clearance/env.sh";
export const CLEARANCE_PID_PATH = ".cache/clearance/clearance.pid";
export const SAFEHOUSE_SIDECAR_PATH = ".config/agent-safehouse/env.sh";
export const SAFEHOUSE_OVERRIDES_PATH =
  ".config/agent-safehouse/local-overrides.sb";

export interface ClearanceStatus {
  personalFileExists: boolean;
  personalFileHasClaudeHosts: boolean;
  envExported: boolean;
  /** Pid from the daemon pid file, only when that process is alive. */
  daemonPid: number | null;
  /** Age of the pid FILE in whole seconds, regardless of pid liveness. */
  daemonAgeSeconds: number | null;
}

export interface SafehouseStatus {
  binaryAvailable: boolean;
  binaryPath: string | null;
  brewFormulaInstalled: boolean;
  envExported: boolean;
  sidecarPresent: boolean;
  sidecarHasFunctions: boolean;
}

/** Read the rc candidates under `home`; unreadable files contribute nothing (read-only). */
export function readRcFiles(home: string): RcFileContent[] {
  const out: RcFileContent[] = [];
  for (const name of RC_CANDIDATES) {
    const file = path.join(home, name);
    try {
      out.push({ file, content: readFileSync(file, "utf8") });
    } catch {
      // Missing or unreadable rc file: skip (probes never fail hard).
    }
  }
  return out;
}

function readTextOrNull(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

// Live env first (authoritative when the user's shell sourced the sidecar),
// anchored rc scan as the fallback signal.
function envVarExported(
  name: string,
  home: string,
  env: NodeJS.ProcessEnv,
): boolean {
  if (env[name] !== undefined && env[name] !== "") return true;
  return scanRcContents(readRcFiles(home), [{ kind: "export", name }]).has(
    name,
  );
}

// Signal 0 performs the kernel existence check without delivering anything.
// EPERM means the process exists but we may not signal it: still alive.
function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function probeClearance(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
): ClearanceStatus {
  const personalFile = path.join(home, CLEARANCE_PERSONAL_HOSTS_PATH);
  const personalContent = readTextOrNull(personalFile);
  const personalFileExists = personalContent !== null;
  const personalFileHasClaudeHosts =
    personalContent !== null &&
    personalContent.split("\n").some((line) => {
      const stripped = line.trim();
      return (
        stripped.length > 0 &&
        !stripped.startsWith("#") &&
        stripped.includes("downloads.claude.ai")
      );
    });

  const envExported = envVarExported("CLEARANCE_ALLOW_HOSTS_FILES", home, env);

  const pidFile = path.join(home, CLEARANCE_PID_PATH);
  let daemonPid: number | null = null;
  let daemonAgeSeconds: number | null = null;
  try {
    const mtimeMs = statSync(pidFile).mtimeMs;
    daemonAgeSeconds = Math.round((Date.now() - mtimeMs) / 1000);
    const raw = readFileSync(pidFile, "utf8").trim();
    const candidate = Number.parseInt(raw, 10);
    // The whole string must be an integer: "12ab" and "" both disqualify.
    if (String(candidate) === raw && pidIsAlive(candidate)) {
      daemonPid = candidate;
    }
  } catch {
    // No pid file (or unreadable): both fields stay null.
  }

  return {
    personalFileExists,
    personalFileHasClaudeHosts,
    envExported,
    daemonPid,
    daemonAgeSeconds,
  };
}

const SAFE_FN_RE = /^\s*safe\s*\(\s*\)/m;
const SAFE_CLAUDE_FN_RE = /^\s*safe-claude\s*\(\s*\)/m;

export async function probeSafehouse(
  home: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: InstallDeps = defaultInstallDeps(),
): Promise<SafehouseStatus> {
  const binaryPath = deps.which("safehouse");
  const formula = await probeSafehouseFormula(deps);
  const envExported = envVarExported("SAFEHOUSE_APPEND_PROFILE", home, env);

  const sidecarContent = readTextOrNull(
    path.join(home, SAFEHOUSE_SIDECAR_PATH),
  );
  const sidecarPresent = sidecarContent !== null;
  const sidecarHasFunctions =
    sidecarContent !== null &&
    SAFE_FN_RE.test(sidecarContent) &&
    SAFE_CLAUDE_FN_RE.test(sidecarContent);

  return {
    binaryAvailable: binaryPath !== null,
    binaryPath,
    brewFormulaInstalled: formula.action === "already-installed",
    envExported,
    sidecarPresent,
    sidecarHasFunctions,
  };
}
