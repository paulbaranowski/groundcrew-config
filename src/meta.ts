import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Usage text mirrors the three invocation forms documented in the README.
const HELP = `crew-config — interactive editor for groundcrew's crew.config.json

Usage:
  crew-config            edit the global ~/.config/groundcrew/crew.config.json
  crew-config --local    edit ./crew.config.json in the current project
  crew-config <path>     edit the crew.config.json at <path>
  crew-config upgrade    upgrade crew-config to the latest version
  crew-config doctor     check the machine setup (groundcrew, safehouse, clearance); --json for machines

Flags:
  -h, --help       show this help and exit
  -v, --version    print the version and exit`;

// Read the package version at runtime rather than inlining it: the same
// "../package.json" relative to this module resolves in every context — dev
// (src/meta.ts), the built bundle (dist/cli.js), and the Homebrew install
// (libexec/dist/cli.js beside libexec/package.json) — and avoids importing JSON
// from outside tsconfig's rootDir.
export function readVersion(): string {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

// Returns the text to print for a non-interactive meta flag, or null when the
// argv carries none (the normal case that launches the TUI). Kept pure and
// TTY-free so it can be unit-tested without rendering Ink.
export function metaOutput(argv: string[]): string | null {
  if (argv.includes("--version") || argv.includes("-v")) return readVersion();
  if (argv.includes("--help") || argv.includes("-h")) return HELP;
  return null;
}
