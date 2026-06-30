import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

// crew-config ships through two install channels; `crew-config upgrade` detects
// which one produced the running binary and re-runs that channel's upgrade.
//   - brew:      Homebrew formula on the user's tap (macOS)
//   - installer: the curl|bash install.sh, an `npm install -g` (Linux or Mac)
// "unknown" means we couldn't place the binary under either channel's prefix
// (e.g. a source checkout) — we refuse to guess and just print guidance.
export type Channel = "brew" | "installer" | "unknown";

const BREW_FORMULA = "paulbaranowski/tap/crew-config";
const INSTALLER_URL =
  "https://github.com/paulbaranowski/groundcrew-config/releases/latest/download/install.sh";
const INSTALLER_PIPELINE = `curl -fsSL ${INSTALLER_URL} | bash`;

export interface DetectInput {
  /** realpath of the running CLI (process.argv[1] resolved). */
  scriptRealpath: string;
  /** realpath of `brew --prefix crew-config`, or "" if brew/formula absent. */
  brewFormulaPrefix: string;
  /** realpath of `npm prefix -g`, or "" if unavailable. */
  npmGlobalPrefix: string;
}

// True when `child` is `parent` or nested beneath it, compared by whole path
// segments so "/usr/local-other" is NOT treated as under "/usr/local". An empty
// parent (channel not present) never matches.
function isContained(child: string, parent: string): boolean {
  if (parent === "") return false;
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Detection keys off the formula-specific keg rather than the whole Homebrew
// prefix: when Homebrew's own node is used for `npm install -g`, the npm global
// tree lives inside /opt/homebrew, so a whole-prefix check would misread a
// curl-installed binary as brew-managed. A formula keg can never contain an
// npm-global package, so containment against it is unambiguous.
export function detectChannel(input: DetectInput): Channel {
  if (isContained(input.scriptRealpath, input.brewFormulaPrefix)) return "brew";
  if (isContained(input.scriptRealpath, input.npmGlobalPrefix)) {
    return "installer";
  }
  return "unknown";
}

export interface UpgradeCommand {
  /** The exact command we echo before running, for transparency. */
  echo: string;
  cmd: string;
  args: string[];
}

export function commandFor(channel: Channel): UpgradeCommand | null {
  if (channel === "brew") {
    return {
      echo: `brew upgrade ${BREW_FORMULA}`,
      cmd: "brew",
      args: ["upgrade", BREW_FORMULA],
    };
  }
  if (channel === "installer") {
    // Run the curl|bash pipeline through a shell so the pipe is honored.
    return {
      echo: INSTALLER_PIPELINE,
      cmd: "bash",
      args: ["-c", INSTALLER_PIPELINE],
    };
  }
  return null;
}

function guidanceText(): string {
  return [
    "Could not determine how crew-config was installed (it looks like a source",
    "checkout or an unrecognized location), so nothing was changed.",
    "",
    "Upgrade manually with whichever matches your install:",
    `  Homebrew:  brew upgrade ${BREW_FORMULA}`,
    `  Installer: ${INSTALLER_PIPELINE}`,
  ].join("\n");
}

// Seam for tests: every effect (path resolution, channel-prefix probing, the
// upgrade spawn, logging) is injected, mirroring how App takes initialDraft /
// target so it can run without a TTY. Production wires the real implementations
// via defaultDeps().
export interface UpgradeDeps {
  /** The invoked CLI path (typically process.argv[1]). */
  scriptPath: string;
  /** Resolve a path to its real location; may throw on a missing path. */
  realpath: (p: string) => string;
  brewFormulaPrefix: () => string;
  npmGlobalPrefix: () => string;
  /** Spawn the upgrade, inheriting stdio; return the child's exit code. */
  run: (cmd: string, args: string[]) => number;
  log: (message: string) => void;
}

function tryRealpath(p: string, realpath: (p: string) => string): string {
  try {
    return realpath(p);
  } catch {
    return "";
  }
}

// Run a command expected to print a single path; return its realpath, or "" on
// any failure (command missing, non-zero exit, empty output, unresolvable path)
// so a probe never throws and an absent channel simply doesn't match.
function prefixFromCommand(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error || r.status !== 0 || typeof r.stdout !== "string") return "";
  const out = r.stdout.trim();
  if (out === "") return "";
  return tryRealpath(out, realpathSync);
}

function defaultDeps(): UpgradeDeps {
  return {
    scriptPath: process.argv[1] ?? "",
    realpath: realpathSync,
    brewFormulaPrefix: () =>
      prefixFromCommand("brew", ["--prefix", "crew-config"]),
    npmGlobalPrefix: () => prefixFromCommand("npm", ["prefix", "-g"]),
    run: (cmd, args) => spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1,
    log: (message) => console.log(message),
  };
}

// Detect the install channel and upgrade in place. Returns a process exit code:
// the child's code on a real upgrade, or 1 when the channel can't be
// determined (guidance is printed and nothing is run). Synchronous — it uses
// spawnSync — so the caller can `process.exit(runUpgrade())` directly.
export function runUpgrade(deps: Partial<UpgradeDeps> = {}): number {
  const d = { ...defaultDeps(), ...deps };
  const scriptRealpath = tryRealpath(d.scriptPath, d.realpath);
  const channel = detectChannel({
    scriptRealpath,
    brewFormulaPrefix: d.brewFormulaPrefix(),
    npmGlobalPrefix: d.npmGlobalPrefix(),
  });
  const command = commandFor(channel);
  if (command === null) {
    d.log(guidanceText());
    return 1;
  }
  d.log(`Upgrading crew-config via: ${command.echo}`);
  return d.run(command.cmd, command.args);
}
