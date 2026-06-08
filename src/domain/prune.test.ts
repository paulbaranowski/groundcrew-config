import { expect, test } from "vitest";
import { pruneEmpty } from "./prune.ts";

test("drops undefined, empty string, empty array, empty object", () => {
  const input = {
    workspace: { projectDir: "~/dev", knownRepositories: [], worktreeDir: "" },
    git: { remote: "", branchPrefix: undefined },
    orchestrator: {},
  };
  expect(pruneEmpty(input)).toEqual({
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  });
});

test("keeps workspace even if it became empty after prune", () => {
  expect(pruneEmpty({ workspace: {} })).toEqual({ workspace: {} });
});

test("preserves populated nested values", () => {
  const input = {
    workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
    git: { remote: "origin" },
  };
  expect(pruneEmpty(input)).toEqual(input);
});
