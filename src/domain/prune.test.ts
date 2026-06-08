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

test("preserves built-in model enable markers (empty object under models.definitions)", () => {
  // `definitions: { claude: {} }` enables the built-in claude model; the empty
  // object is meaningful and must survive pruning, else the saved config has a
  // default model with no matching definition and groundcrew rejects it.
  const input = {
    workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
    models: { default: "claude", definitions: { claude: {} } },
  };
  expect(pruneEmpty(input)).toEqual(input);
});

test("preserves populated nested values", () => {
  const input = {
    workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
    git: { remote: "origin" },
  };
  expect(pruneEmpty(input)).toEqual(input);
});
