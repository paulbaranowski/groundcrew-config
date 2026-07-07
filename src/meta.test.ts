import { expect, test } from "vitest";
import { metaOutput, readVersion } from "./meta.ts";

test("--version / -v print the package version, not the TUI", () => {
  const version = readVersion();
  expect(version).toMatch(/^\d+\.\d+\.\d+/);
  expect(metaOutput(["--version"])).toBe(version);
  expect(metaOutput(["-v"])).toBe(version);
});

test("--help / -h print usage with the invocation forms", () => {
  for (const flag of ["--help", "-h"]) {
    const out = metaOutput([flag]);
    expect(out).toContain("Usage:");
    expect(out).toContain("crew-config --local");
    expect(out).toContain("<path>");
    expect(out).toContain("crew-config doctor");
  }
});

test("no meta flag returns null so the TUI launches normally", () => {
  expect(metaOutput([])).toBeNull();
  expect(metaOutput(["--local"])).toBeNull();
  expect(metaOutput(["./crew.config.json"])).toBeNull();
});
