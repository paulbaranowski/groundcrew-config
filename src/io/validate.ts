import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
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
  ["agents", "agents"],
  ["linear", "ticketSources"],
  ["sources", "ticketSources"],
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
): Promise<ValidationResult> {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-validate-"));
  const file = path.join(dir, "crew.config.json");
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
  }
}
