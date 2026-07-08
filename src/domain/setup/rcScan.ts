// Login-shell rc candidates, scanned in this order for conflict precedence.
// Missing files are skipped, so the same order is correct on macOS (zsh-first)
// and Linux (a bash box simply has no ~/.zshrc and starts at ~/.bashrc).
export const RC_CANDIDATES = [
  ".zshrc",
  ".bash_profile",
  ".bashrc",
  ".profile",
] as const;

export interface RcFileContent {
  /** Path the content came from; carried into RcMatch for the sidecar note. */
  file: string;
  content: string;
}

export type RcTarget =
  | { kind: "export"; name: string }
  | { kind: "function"; name: string };

export interface RcMatch {
  /** The var or function name that matched. */
  item: string;
  file: string;
  /** 1-based line number of the first uncommented match. */
  line: number;
  /** RHS of `export VAR=...`, quotes stripped; null for functions and bare exports. */
  value: string | null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Anchored patterns, never substrings: `export VAR` must start the (stripped)
// line and be followed by `=`, whitespace, or end-of-line; a function must be
// `name()` at the start of the line. Substring matching would flag lines that
// merely mention the name and make the smart-merge comment out a definition
// the rc does not actually own.
function exportPattern(name: string): RegExp {
  return new RegExp(`^\\s*export\\s+${escapeRegExp(name)}(?=[=\\s]|$)`);
}

function functionPattern(name: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(name)}\\s*\\(\\s*\\)`);
}

/** RHS of `export VAR=...` with surrounding quotes stripped, or null. */
export function extractExportValue(
  strippedLine: string,
  name: string,
): string | null {
  const m = strippedLine.match(
    new RegExp(`^\\s*export\\s+${escapeRegExp(name)}=(.*)$`),
  );
  if (m === null) return null;
  const raw = m[1]!.trim();
  const first = raw[0];
  if (
    raw.length >= 2 &&
    first === raw[raw.length - 1] &&
    (first === '"' || first === "'")
  ) {
    return raw.slice(1, -1);
  }
  return raw.length > 0 ? raw : null;
}

/**
 * Scan rc contents (in the given file order) for the first uncommented
 * definition of each target. Comment and blank lines never match. First
 * match per item wins across files, mirroring login-shell precedence.
 */
export function scanRcContents(
  files: readonly RcFileContent[],
  targets: readonly RcTarget[],
): Map<string, RcMatch> {
  const found = new Map<string, RcMatch>();
  for (const { file, content } of files) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const stripped = lines[i]!.trim();
      if (stripped.length === 0 || stripped.startsWith("#")) continue;
      for (const target of targets) {
        if (found.has(target.name)) continue;
        const pattern =
          target.kind === "export"
            ? exportPattern(target.name)
            : functionPattern(target.name);
        if (pattern.test(stripped)) {
          found.set(target.name, {
            item: target.name,
            file,
            line: i + 1,
            value:
              target.kind === "export"
                ? extractExportValue(stripped, target.name)
                : null,
          });
        }
      }
    }
    if (found.size === targets.length) break;
  }
  return found;
}
