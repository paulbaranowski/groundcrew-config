import { existsSync } from "node:fs";
import path from "node:path";
import { targetPath, type Target } from "./save.ts";

export interface Located {
  target: Target;
  path: string;
}

// Load precedence mirrors groundcrew's loader (it prefers .ts/.mjs/.js over
// .json). The save target is always crew.config.json (see save.ts).
const CONFIG_BASENAMES = [
  "crew.config.ts",
  "crew.config.mjs",
  "crew.config.js",
  "crew.config.json",
];

export function locate(argv: string[], cwd: string): Located {
  const explicit = argv.find((a) => !a.startsWith("-"));
  const scope = argv.includes("--global") ? "global" : "local";
  const target: Target = { scope, cwd };
  if (explicit !== undefined) {
    return { target, path: path.resolve(cwd, explicit) };
  }
  // Load from an existing config of any supported format in the target dir;
  // fall back to the .json save path when none exists (loadDraft then returns
  // undefined → the editor opens empty).
  const dir = path.dirname(targetPath(target));
  const existing = CONFIG_BASENAMES.map((name) => path.join(dir, name)).find(
    existsSync,
  );
  return { target, path: existing ?? targetPath(target) };
}
