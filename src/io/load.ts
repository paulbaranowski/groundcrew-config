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

/**
 * Read an existing config of any format into a raw draft, or undefined if absent.
 *
 * The returned value is UNVALIDATED disk input: its true validity is established
 * later by groundcrew's loadConfig (see io/validate.ts), not here. Consumers must
 * not assume required fields are present or well-typed just because the static
 * type says ConfigDraft.
 */
export async function loadDraft(
  filepath: string,
): Promise<ConfigDraft | undefined> {
  if (!existsSync(filepath)) return undefined;
  if (path.extname(filepath) === ".json") {
    const text = readFileSync(filepath, "utf8");
    try {
      // Unvalidated: parsed JSON is asserted, not checked; validity is groundcrew's.
      return JSON.parse(text) as ConfigDraft;
    } catch (error) {
      // Fail loud with the offending file: a silent undefined would be read as
      // "no config" and the wizard would overwrite the user's broken-but-real file.
      throw new Error(
        `Invalid JSON in ${filepath}: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }
  const result = await explorer.load(filepath);
  // Unvalidated: cosmiconfig's loaded config is asserted, not checked; validity is groundcrew's.
  return (result?.config ?? undefined) as ConfigDraft | undefined;
}
