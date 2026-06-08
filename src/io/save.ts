import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pruneEmpty } from "../domain/prune.ts";
import type { ConfigDraft } from "../domain/types.ts";
import { xdgConfigDir } from "../domain/xdg.ts";

export type Scope = "local" | "global";
export interface Target {
  scope: Scope;
  cwd: string;
}
export interface SaveResult {
  path: string;
  shadowed: string | undefined;
}

// Loader checks these (any extension) before crew.config.json, so a leftover
// would shadow what we write. Move it aside.
const SHADOWING = ["crew.config.ts", "crew.config.mjs", "crew.config.js"];

export function targetPath(target: Target): string {
  const dir = target.scope === "global" ? xdgConfigDir() : target.cwd;
  return path.join(dir, "crew.config.json");
}

export async function saveDraft(
  target: Target,
  draft: ConfigDraft,
): Promise<SaveResult> {
  const out = targetPath(target);
  const dir = path.dirname(out);
  mkdirSync(dir, { recursive: true });

  let shadowed: string | undefined;
  for (const name of SHADOWING) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) {
      const backup = `${candidate}.bak`;
      renameSync(candidate, backup);
      shadowed = backup;
      break;
    }
  }

  const json = JSON.stringify(
    pruneEmpty(draft as unknown as Record<string, unknown>),
    undefined,
    2,
  );
  writeFileSync(out, `${json}\n`);
  return { path: out, shadowed };
}
