import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pruneEmpty } from "../domain/prune.ts";
import type { ConfigDraft, SectionId } from "../domain/types.ts";

const run = promisify(execFile);

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; section: SectionId | undefined };

// Resolve groundcrew's entry once so the child imports it by absolute URL,
// independent of the child's cwd.
const groundcrewUrl = import.meta.resolve("@clipboard-health/groundcrew");

const CHILD = `
const { loadConfig } = await import(${JSON.stringify(groundcrewUrl)});
try { await loadConfig(); }
catch (error) { console.error(error?.message ?? String(error)); process.exit(1); }
`;

// Ordered most-specific-first: a longer key that *contains* a shorter one must
// be tested before it, e.g. "workspaceKind" before "workspace" (since
// "workspaceKind".includes("workspace") is true) and "defaults.hooks" before
// any bare "hooks" check.
//
// "usage" is listed before "agents" on purpose: in groundcrew config there is no
// top-level `usage` key — usage always lives under
// `agents.definitions.<name>.usage.*`, which contains both substrings. Routing
// those errors to the Usage badge (not Agents) points the user at the Usage
// screen, where the `usage.disabled` toggle that owns this config actually lives.
const SECTION_PREFIXES: Array<[string, SectionId]> = [
  ["knownRepositories", "repositories"],
  ["workspaceKind", "terminal"],
  ["defaults.hooks", "hooks"],
  ["workspace", "workspace"],
  ["usage", "usage"],
  // The session limit is edited on the Usage Limits screen even though it lives
  // under `orchestrator.*` in the file — route its errors to that badge. Must
  // precede the bare "orchestrator" entry below (most-specific-first).
  ["orchestrator.sessionLimitPercentage", "usage"],
  ["agents", "agents"],
  ["linear", "taskSources"],
  ["sources", "taskSources"],
  ["orchestrator", "orchestrator"],
  ["git", "git"],
  ["local", "sandbox"],
  ["prompts", "prompts"],
  ["logging", "advanced"],
];

export function mapSection(message: string): SectionId | undefined {
  // groundcrew errors read "groundcrew config: <key.path> <prose>". The section
  // identity lives in the key path; match only against it, not the whole
  // message. Otherwise prose that happens to name a section keyword — e.g. the
  // allowed-placeholder list "{{workspaceContinuationInstruction}}" in a
  // prompts.initial error — hijacks the badge (here, mis-routing to workspace).
  const keyPath = message.replace(/^groundcrew config:\s*/, "").split(/\s/, 1)[0] ?? "";
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (keyPath.includes(prefix)) return section;
  }
  return undefined;
}

export async function validateDraft(
  draft: ConfigDraft,
  configDir?: string,
): Promise<ValidationResult> {
  // Validate in the config's *real* directory when it exists, so config-dir-
  // relative paths (e.g. prompts.promptFile) resolve exactly as groundcrew will
  // resolve them at load time. A throwaway temp dir — the old behavior — made
  // every such relative path fail to resolve, flagging a valid config. Fall
  // back to a temp dir only for an unsaved config whose directory is not yet on
  // disk, where a relative path is genuinely unresolvable anyway.
  // existsSync alone is true for a file too; a file path here would make the
  // writeFileSync below throw ENOTDIR. Require an actual directory, else fall
  // back to the temp dir (same as a not-yet-on-disk config dir).
  const inPlace =
    configDir !== undefined &&
    existsSync(configDir) &&
    statSync(configDir).isDirectory();
  const dir = inPlace
    ? configDir
    : mkdtempSync(path.join(tmpdir(), "cc-validate-"));
  // A dotfile sidecar groundcrew reads directly via GROUNDCREW_CONFIG (so it
  // never shadows the user's own crew.config.json discovery), placed *in* the
  // config dir — not a subdir — so `path.dirname` matches the real config's.
  const file = path.join(dir, `.crew.config.validate-${randomUUID()}.json`);
  writeFileSync(
    file,
    JSON.stringify(pruneEmpty(draft as unknown as Record<string, unknown>)),
  );
  try {
    await run(process.execPath, ["--input-type=module", "-e", CHILD], {
      env: { ...process.env, GROUNDCREW_CONFIG: file },
    });
    return { ok: true };
  } catch (error) {
    const message =
      (error as { stderr?: string }).stderr?.trim() || String(error);
    return { ok: false, message, section: mapSection(message) };
  } finally {
    rmSync(file, { force: true });
    if (!inPlace) rmSync(dir, { recursive: true, force: true });
  }
}
