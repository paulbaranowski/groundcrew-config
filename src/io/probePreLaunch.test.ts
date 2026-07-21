import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { parseProbeOutput, probePreLaunch } from "./probePreLaunch.ts";

let dir: string;
let tokenFile: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cc-probe-"));
  tokenFile = path.join(dir, "jira.token");
  writeFileSync(tokenFile, "s3cr3t-value-123\n");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("parseProbeOutput maps name lengths and the exit code", () => {
  const out = "GITHUB_TOKEN\t40\nJIRA_API_TOKEN\t0\n__rc=0\n";
  expect(parseProbeOutput(out, ["GITHUB_TOKEN", "JIRA_API_TOKEN"])).toEqual({
    rows: [
      { name: "GITHUB_TOKEN", length: 40 },
      { name: "JIRA_API_TOKEN", length: 0 },
    ],
    exitCode: 0,
  });
});

test("parseProbeOutput reports a name absent from output as length 0", () => {
  // Hook aborted before the loop (e.g. `set -e`): no NAME line, no __rc line.
  const { rows, exitCode } = parseProbeOutput("", ["JIRA_API_TOKEN"]);
  expect(rows).toEqual([{ name: "JIRA_API_TOKEN", length: 0 }]);
  expect(exitCode).toBeNaN();
});

test("a hook that reads an existing token file reports a non-zero length", async () => {
  const result = await probePreLaunch(
    `export JIRA_API_TOKEN="$(cat ${tokenFile})"`,
    ["JIRA_API_TOKEN"],
  );
  expect(result.exitCode).toBe(0);
  expect(result.rows).toEqual([{ name: "JIRA_API_TOKEN", length: 16 }]);
});

test("a hook that cats a missing file reports length 0 and surfaces stderr", async () => {
  const missing = path.join(dir, "jira-token"); // hyphen — does not exist
  const result = await probePreLaunch(
    `export JIRA_API_TOKEN="$(cat ${missing})"`,
    ["JIRA_API_TOKEN"],
  );
  expect(result.rows).toEqual([{ name: "JIRA_API_TOKEN", length: 0 }]);
  expect(result.stderr).toContain("No such file");
});

test("the probe unsets names first so an inherited value cannot mask an empty hook", async () => {
  // The name is already in the environment, but the hook (`:`) never sets it.
  process.env.PROBE_INHERITED = "leaked-from-parent-env";
  try {
    const result = await probePreLaunch(":", ["PROBE_INHERITED"], { cwd: dir });
    // The probe's `unset` scrubs the inherited value first — matching
    // groundcrew's pre-hook scrub — so the reported length is 0, not 22.
    expect(result.rows).toEqual([{ name: "PROBE_INHERITED", length: 0 }]);
  } finally {
    delete process.env.PROBE_INHERITED;
  }
});

test("set -e abort is caught: length 0 and a non-zero exit code", async () => {
  const missing = path.join(dir, "nope.token");
  // A bare assignment's exit status IS the command substitution's, so `set -e`
  // aborts here — unlike `export X="$(cat …)"`, where the `export` builtin
  // returns 0 and masks the failure (the very footgun the length signal exists
  // to catch). This case exercises the genuine-abort path: the hook dies before
  // the report loop, so no NAME line is printed and the shell exits non-zero.
  const result = await probePreLaunch(
    `set -euo pipefail; JIRA_API_TOKEN="$(cat ${missing})"; export JIRA_API_TOKEN`,
    ["JIRA_API_TOKEN"],
  );
  expect(result.rows).toEqual([{ name: "JIRA_API_TOKEN", length: 0 }]);
  expect(result.exitCode).not.toBe(0);
});

test("the export-masks-failure footgun is still caught by length, not exit code", async () => {
  // `export X="$(cat missing)"` exits 0 even though cat failed — the exact
  // silent-empty-token bug. The exit code lies (0); length 0 is the only tell.
  const missing = path.join(dir, "jira-token"); // hyphen — does not exist
  const result = await probePreLaunch(
    `set -euo pipefail; export JIRA_API_TOKEN="$(cat ${missing})"`,
    ["JIRA_API_TOKEN"],
  );
  expect(result.rows).toEqual([{ name: "JIRA_API_TOKEN", length: 0 }]);
  expect(result.exitCode).toBe(0); // the footgun: a "clean" exit masking empty
  expect(result.stderr).toContain("No such file");
});

test("non-POSIX names are skipped, not shell-interpolated", async () => {
  const result = await probePreLaunch("export OK=abc", ["OK", "bad name", "1BAD"], {
    cwd: dir,
  });
  expect(result.skipped).toEqual(["bad name", "1BAD"]);
  expect(result.rows).toEqual([{ name: "OK", length: 3 }]);
});

test("{{worktree}} is substituted with the provided stand-in", async () => {
  const result = await probePreLaunch(
    `export WT="{{worktree}}"`,
    ["WT"],
    { worktree: "/tmp/some-worktree" },
  );
  expect(result.rows).toEqual([{ name: "WT", length: "/tmp/some-worktree".length }]);
});
