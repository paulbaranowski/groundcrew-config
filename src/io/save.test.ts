import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { saveDraft, targetPath } from "./save.ts";

function dir(): string {
  return mkdtempSync(path.join(tmpdir(), "cc-save-"));
}

test("targetPath maps local scope to cwd/crew.config.json", () => {
  expect(targetPath({ scope: "local", cwd: "/work" })).toBe(
    "/work/crew.config.json",
  );
});

test("writes minimal pruned json", async () => {
  const cwd = dir();
  const result = await saveDraft(
    { scope: "local", cwd },
    {
      workspace: { projectDir: "~/d", knownRepositories: ["a/b"] },
      orchestrator: {},
    },
  );
  const written = JSON.parse(readFileSync(result.path, "utf8"));
  expect(written).toEqual({
    workspace: { projectDir: "~/d", knownRepositories: ["a/b"] },
  });
  expect(result.shadowed).toEqual([]);
});

test("renames a shadowing crew.config.ts to .bak", async () => {
  const cwd = dir();
  writeFileSync(path.join(cwd, "crew.config.ts"), "export default {};");
  const result = await saveDraft(
    { scope: "local", cwd },
    { workspace: { projectDir: "~/d", knownRepositories: [] } },
  );
  expect(existsSync(path.join(cwd, "crew.config.ts"))).toBe(false);
  expect(existsSync(path.join(cwd, "crew.config.ts.bak"))).toBe(true);
  expect(result.shadowed).toEqual([path.join(cwd, "crew.config.ts.bak")]);
});

test("does not clobber an existing .bak backup", async () => {
  const cwd = dir();
  writeFileSync(path.join(cwd, "crew.config.ts"), "export default {};");
  writeFileSync(path.join(cwd, "crew.config.ts.bak"), "OLD BACKUP");
  const result = await saveDraft(
    { scope: "local", cwd },
    { workspace: { projectDir: "~/d", knownRepositories: [] } },
  );
  // The pre-existing backup must be preserved untouched.
  expect(readFileSync(path.join(cwd, "crew.config.ts.bak"), "utf8")).toBe(
    "OLD BACKUP",
  );
  // The new backup gets a unique name.
  expect(result.shadowed).toEqual([path.join(cwd, "crew.config.ts.bak.1")]);
  expect(existsSync(path.join(cwd, "crew.config.ts.bak.1"))).toBe(true);
});

test("renames every shadowing file, not just the first", async () => {
  const cwd = dir();
  writeFileSync(path.join(cwd, "crew.config.ts"), "export default {};");
  writeFileSync(path.join(cwd, "crew.config.mjs"), "export default {};");
  const result = await saveDraft(
    { scope: "local", cwd },
    { workspace: { projectDir: "~/d", knownRepositories: [] } },
  );
  expect(existsSync(path.join(cwd, "crew.config.ts"))).toBe(false);
  expect(existsSync(path.join(cwd, "crew.config.mjs"))).toBe(false);
  expect(existsSync(path.join(cwd, "crew.config.ts.bak"))).toBe(true);
  expect(existsSync(path.join(cwd, "crew.config.mjs.bak"))).toBe(true);
  expect(result.shadowed).toEqual([
    path.join(cwd, "crew.config.ts.bak"),
    path.join(cwd, "crew.config.mjs.bak"),
  ]);
});
