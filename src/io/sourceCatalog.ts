import type {
  CatalogSource,
  ManifestPrerequisite,
  ManifestSecret,
  SourceManifestInfo,
} from "../domain/manifestSources.ts";

/**
 * Load groundcrew's task-source catalog (`listTaskSources` +
 * `getTaskSourceManifest`, exported since the open-registry work) and join each
 * discovered entry with its manifest for the hub / manifest screen to render.
 *
 * The exports are feature-detected at runtime: against an older groundcrew (or
 * any import/discovery failure) this resolves to `[]` and the hub falls back to
 * its static rows. Never rejects — a broken catalog must not take down the TUI.
 */

const ORIGINS = new Set(["builtin", "package", "user"]);

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function narrowPrerequisites(raw: unknown): ManifestPrerequisite[] {
  if (!Array.isArray(raw)) return [];
  const out: ManifestPrerequisite[] = [];
  for (const entry of raw) {
    const e = entry as Record<string, unknown>;
    if (typeof e?.bin !== "string") continue;
    out.push({
      bin: e.bin,
      install: asOptionalString(e.install),
      setup: asOptionalString(e.setup),
    });
  }
  return out;
}

function narrowSecrets(raw: unknown): ManifestSecret[] {
  if (!Array.isArray(raw)) return [];
  const out: ManifestSecret[] = [];
  for (const entry of raw) {
    const e = entry as Record<string, unknown>;
    if (typeof e?.env !== "string") continue;
    out.push({
      env: e.env,
      file: asOptionalString(e.file),
      mode: asOptionalString(e.mode),
      url: asOptionalString(e.url),
    });
  }
  return out;
}

function narrowEnv(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function narrowManifest(raw: unknown): SourceManifestInfo | undefined {
  const m = raw as Record<string, unknown> | undefined | null;
  if (m === null || typeof m !== "object" || typeof m.name !== "string") {
    return undefined;
  }
  return {
    name: m.name,
    description: asOptionalString(m.description),
    installDir: asOptionalString(m.installDir),
    prerequisites: narrowPrerequisites(m.prerequisites),
    secrets: narrowSecrets(m.secrets),
    env: narrowEnv(m.env),
  };
}

/**
 * The catalog projection over an already-imported groundcrew module object.
 * Split from `loadSourceCatalog` so tests can drive it with fakes instead of
 * the real (version-dependent) package.
 */
export async function catalogFromModule(
  mod: Record<string, unknown>,
): Promise<CatalogSource[]> {
  const { listTaskSources, getTaskSourceManifest } = mod;
  if (typeof listTaskSources !== "function") return [];
  let entries: unknown;
  try {
    entries = await (listTaskSources as () => Promise<unknown>)();
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];

  const catalog: CatalogSource[] = [];
  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    if (typeof e?.name !== "string" || typeof e.description !== "string") {
      continue;
    }
    const origin = ORIGINS.has(e.origin as string)
      ? (e.origin as CatalogSource["origin"])
      : "user";
    let manifest: SourceManifestInfo | undefined;
    if (origin !== "builtin" && typeof getTaskSourceManifest === "function") {
      try {
        manifest = narrowManifest(
          (getTaskSourceManifest as (name: string) => unknown)(e.name),
        );
      } catch {
        manifest = undefined;
      }
    }
    catalog.push({
      name: e.name,
      description: e.description,
      origin,
      requiresCredentials: e.requiresCredentials === true,
      manifest,
    });
  }
  return catalog;
}

export async function loadSourceCatalog(): Promise<CatalogSource[]> {
  try {
    const mod = (await import("@clipboard-health/groundcrew")) as Record<
      string,
      unknown
    >;
    return await catalogFromModule(mod);
  } catch {
    return [];
  }
}
