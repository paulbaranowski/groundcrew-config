import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { loadDraft } from "./load.ts";

function tmp(name: string, contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-load-"));
  const file = path.join(dir, name);
  writeFileSync(file, contents);
  return file;
}

test("reads json literally", async () => {
  const file = tmp(
    "crew.config.json",
    JSON.stringify({
      workspace: { projectDir: "~/d", knownRepositories: ["a/b"] },
    }),
  );
  expect(await loadDraft(file)).toEqual({
    workspace: { projectDir: "~/d", knownRepositories: ["a/b"] },
  });
});

test("reads ts default export literally (no defaults applied)", async () => {
  const file = tmp(
    "crew.config.ts",
    `export default { workspace: { projectDir: "~/d", knownRepositories: [] } };`,
  );
  const draft = await loadDraft(file);
  expect(draft).toEqual({
    workspace: { projectDir: "~/d", knownRepositories: [] },
  });
  if (draft === undefined) throw new Error("expected a draft");
  expect("git" in draft).toBe(false); // raw, not resolved
});

test("returns empty draft for a missing file", async () => {
  expect(await loadDraft("/nonexistent/crew.config.json")).toBeUndefined();
});

test("throws a clear error (not a silent undefined) for malformed json", async () => {
  const file = tmp("crew.config.json", "{ not valid json");
  await expect(loadDraft(file)).rejects.toThrow(/crew\.config\.json/);
});
