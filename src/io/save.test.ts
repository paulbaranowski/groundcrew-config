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
  expect(result.shadowed).toBeUndefined();
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
  expect(result.shadowed).toBe(path.join(cwd, "crew.config.ts.bak"));
});
