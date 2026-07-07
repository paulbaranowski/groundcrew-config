import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCommand, which } from "./exec.ts";

describe("runCommand", () => {
  it("returns code 0 and stdout for a successful command", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "console.log('hi')"],
      5000,
    );
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("hi");
    expect(result.error).toBeUndefined();
  });

  it("returns the exit code for a failing command instead of throwing", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "console.error('boom'); process.exit(3)"],
      5000,
    );
    expect(result.code).toBe(3);
    expect(result.stderr.trim()).toBe("boom");
  });

  it("returns code -1 with an error for a nonexistent command", async () => {
    const result = await runCommand("definitely-not-a-real-cmd-xyz", [], 5000);
    expect(result.code).toBe(-1);
    expect(result.error).toBeTruthy();
  });

  it("returns code -1 with a timeout error when the command overruns", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "setTimeout(() => {}, 60_000)"],
      200,
    );
    expect(result.code).toBe(-1);
    expect(result.error).toContain("timed out");
  });
});

describe("which", () => {
  it("finds an executable on the provided PATH", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "exec-which-"));
    const bin = path.join(dir, "mytool");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    expect(which("mytool", { PATH: dir })).toBe(bin);
  });

  it("returns null when the command is not on PATH", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "exec-which-"));
    expect(which("mytool", { PATH: dir })).toBeNull();
  });

  it("returns null for an empty PATH", () => {
    expect(which("node", { PATH: "" })).toBeNull();
  });
});
