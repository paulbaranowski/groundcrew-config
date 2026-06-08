import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cosmiconfig, type Loader } from "cosmiconfig";
import type { ConfigDraft } from "../domain/types.ts";

const importModule: Loader = async (filepath) => {
  const mod = (await import(pathToFileURL(filepath).href)) as {
    default?: unknown;
  };
  return mod.default ?? null;
};

const explorer = cosmiconfig("crew", {
  loaders: { ".ts": importModule, ".mjs": importModule, ".js": importModule },
});

/** Read an existing config of any format into a raw draft, or undefined if absent. */
export async function loadDraft(
  filepath: string,
): Promise<ConfigDraft | undefined> {
  if (!existsSync(filepath)) return undefined;
  if (path.extname(filepath) === ".json") {
    return JSON.parse(readFileSync(filepath, "utf8")) as ConfigDraft;
  }
  const result = await explorer.load(filepath);
  return (result?.config ?? undefined) as ConfigDraft | undefined;
}
