import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pruneEmpty } from "../domain/prune.ts";
import { sectionForKeyPath } from "../domain/sectionRouting.ts";
import type { ConfigDraft, SectionId } from "../domain/types.ts";

const run = promisify(execFile);

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; section: SectionId | undefined };

// Validity is whatever groundcrew's loadConfig accepts — nothing here reimplements
// the schema. It is established out-of-process: the pruned draft is written to a
// temp GROUNDCREW_CONFIG sidecar and a child Node process (CHILD below) imports
// groundcrew's real loadConfig and reports whether it throws. Validation runs in
// the config's REAL directory when it exists, so config-relative paths (e.g.
// prompts.promptFile) resolve exactly as groundcrew will at load time; dropping
// the configDir argument silently flips valid configs to invalid.
//
// SECTION_PREFIXES (the routing table) lives in domain/sectionRouting.ts so the
// modified-marker code can reuse it without importing from io.

// Resolve groundcrew's entry once so the child imports it by absolute URL,
// independent of the child's cwd.
const groundcrewUrl = import.meta.resolve("@clipboard-health/groundcrew");

// Child process body: import groundcrew's real loadConfig and exit non-zero with
// its message if the GROUNDCREW_CONFIG sidecar is rejected.
const CHILD = `
const { loadConfig } = await import(${JSON.stringify(groundcrewUrl)});
try { await loadConfig(); }
catch (error) { console.error(error?.message ?? String(error)); process.exit(1); }
`;

export function mapSection(message: string): SectionId | undefined {
  // groundcrew errors read "groundcrew config: [<filepath>: ]<key.path> <prose>".
  // The filepath prefix is added by the loader when it wraps a thrown validation
  // error (groundcrew ≥ 4.x), so we strip both the constant prefix and the
  // optional path-then-colon, then take the first whitespace-delimited token as
  // the key path. The section identity lives in the key path; matching the
  // whole message would let prose that happens to name a section keyword
  // (e.g. "{{workspaceContinuationInstruction}}" in a prompts.initial error)
  // hijack the badge.
  const stripped = message.replace(/^groundcrew config:\s*/, "");
  // Strip an absolute-path prefix ("<path>:\s+") if present. The optional
  // `[A-Za-z]:` head accepts Windows drive-letter paths (`C:\foo\bar:` …)
  // alongside POSIX absolute paths. The remaining slash requirement still
  // distinguishes path-prefixed wrappers from bare key paths, which never
  // contain a slash.
  const withoutPath = stripped.replace(
    /^(?:[A-Za-z]:)?[^\s:]*[\\/][^\s:]*:\s+/,
    "",
  );
  const keyPath = withoutPath.split(/\s/, 1)[0] ?? "";
  return sectionForKeyPath(keyPath);
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
  writeFileSync(file, JSON.stringify(pruneEmpty(draft)));
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
