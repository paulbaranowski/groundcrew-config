import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { locate } from "./locate.ts";
import { xdgConfigDir } from "../domain/xdg.ts";

function dir(): string {
  return mkdtempSync(path.join(tmpdir(), "cc-locate-"));
}

test("falls back to crew.config.json when no config exists in cwd", () => {
  const cwd = dir();
  expect(locate([], cwd)).toEqual({
    target: { scope: "local", cwd },
    path: path.join(cwd, "crew.config.json"),
  });
});

test("discovers an existing crew.config.ts in the directory", () => {
  const cwd = dir();
  writeFileSync(path.join(cwd, "crew.config.ts"), "export default {};");
  expect(locate([], cwd).path).toBe(path.join(cwd, "crew.config.ts"));
});

test("prefers .ts over .json when both exist (matches groundcrew loader order)", () => {
  const cwd = dir();
  writeFileSync(path.join(cwd, "crew.config.json"), "{}");
  writeFileSync(path.join(cwd, "crew.config.ts"), "export default {};");
  expect(locate([], cwd).path).toBe(path.join(cwd, "crew.config.ts"));
});

test("--global targets the XDG directory", () => {
  const r = locate(["--global"], "/work");
  expect(r.target.scope).toBe("global");
  // The load path lives in the XDG dir (basename depends on what exists there).
  expect(path.dirname(r.path)).toBe(xdgConfigDir());
});

test("an explicit path overrides scope", () => {
  const r = locate(["/etc/crew.config.json"], "/work");
  expect(r.path).toBe("/etc/crew.config.json");
});
