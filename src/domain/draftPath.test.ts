import { expect, test } from "vitest";
import { getByPath, setByPath } from "./draftPath.ts";

test("getByPath reads nested values, undefined when absent", () => {
  const d = { orchestrator: { maximumInProgress: 6 } };
  expect(getByPath(d, "orchestrator.maximumInProgress")).toBe(6);
  expect(getByPath(d, "git.remote")).toBeUndefined();
});

test("setByPath creates intermediate objects immutably", () => {
  const d = { workspace: { projectDir: "~/d", knownRepositories: [] } };
  const next = setByPath(d, "git.remote", "upstream");
  expect(next).toEqual({
    workspace: { projectDir: "~/d", knownRepositories: [] },
    git: { remote: "upstream" },
  });
  expect(d).not.toBe(next);
  expect("git" in d).toBe(false);
});

test("setByPath with undefined removes the leaf", () => {
  const d = { git: { remote: "origin", defaultBranch: "main" } };
  expect(setByPath(d, "git.remote", undefined)).toEqual({
    git: { defaultBranch: "main" },
  });
});
