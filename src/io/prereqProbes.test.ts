import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { binOnPath, secretFileExists } from "./prereqProbes.ts";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "probes-"));
}

test("binOnPath finds an executable on the injected PATH", () => {
  const dir = tempDir();
  const bin = path.join(dir, "jira");
  writeFileSync(bin, "#!/bin/sh\n");
  chmodSync(bin, 0o755);
  expect(binOnPath("jira", { PATH: dir })).toBe(true);
});

test("binOnPath is false for a missing binary or empty PATH", () => {
  const dir = tempDir();
  expect(binOnPath("jira", { PATH: dir })).toBe(false);
  expect(binOnPath("jira", {})).toBe(false);
});

test("binOnPath ignores a non-executable file of the same name", () => {
  const dir = tempDir();
  writeFileSync(path.join(dir, "jira"), "not a program");
  chmodSync(path.join(dir, "jira"), 0o644);
  expect(binOnPath("jira", { PATH: dir })).toBe(false);
});

test("binOnPath scans multiple PATH entries, skipping unreadable ones", () => {
  const missing = path.join(tempDir(), "nope");
  const dir = tempDir();
  const bin = path.join(dir, "jq");
  writeFileSync(bin, "#!/bin/sh\n");
  chmodSync(bin, 0o755);
  const joined = [missing, dir].join(path.delimiter);
  expect(binOnPath("jq", { PATH: joined })).toBe(true);
});

test("secretFileExists checks installDir/file with ~ left to expansion", () => {
  const dir = tempDir();
  mkdirSync(path.join(dir, "nested"), { recursive: true });
  writeFileSync(path.join(dir, "nested", "jira.token"), "tok");
  expect(secretFileExists(path.join(dir, "nested"), "jira.token")).toBe(true);
  expect(secretFileExists(path.join(dir, "nested"), "other.token")).toBe(false);
});

test("secretFileExists expands a leading ~ against the home dir", () => {
  // Can't safely create files in the real home dir; assert the negative path
  // resolves without throwing.
  expect(secretFileExists("~/definitely-missing-crew-config-test", "x")).toBe(
    false,
  );
});
