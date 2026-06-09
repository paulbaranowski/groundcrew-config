import path from "node:path";
import { targetPath, type Target } from "./save.ts";

export interface Located {
  target: Target;
  path: string;
}

export function locate(argv: string[], cwd: string): Located {
  const explicit = argv.find((a) => !a.startsWith("-"));
  const scope = argv.includes("--global") ? "global" : "local";
  const target: Target = { scope, cwd };
  if (explicit !== undefined) {
    return { target, path: path.resolve(cwd, explicit) };
  }
  return { target, path: targetPath(target) };
}
