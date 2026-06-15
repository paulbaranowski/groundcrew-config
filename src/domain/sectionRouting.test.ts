import { expect, test } from "vitest";
import { sectionForKeyPath } from "./sectionRouting.ts";

test("knownRepositories key paths route to repositories", () => {
  expect(sectionForKeyPath("workspace.knownRepositories.0")).toBe(
    "repositories",
  );
});

test("workspaceKind routes to terminal, not workspace (most-specific-first)", () => {
  expect(sectionForKeyPath("workspaceKind")).toBe("terminal");
});

test("workspace.projectDir routes to workspace", () => {
  expect(sectionForKeyPath("workspace.projectDir")).toBe("workspace");
});

test("orchestrator.sessionLimitPercentage routes to usage", () => {
  expect(sectionForKeyPath("orchestrator.sessionLimitPercentage")).toBe(
    "usage",
  );
});

test("other orchestrator.* routes to orchestrator", () => {
  expect(sectionForKeyPath("orchestrator.maximumInProgress")).toBe(
    "orchestrator",
  );
});

test("agents.definitions.x.usage routes to usage (more specific than agents)", () => {
  expect(sectionForKeyPath("agents.definitions.claude.usage.disabled")).toBe(
    "usage",
  );
});

test("bare agents routes to agents", () => {
  expect(sectionForKeyPath("agents.default")).toBe("agents");
});

test("sources.* routes to taskSources", () => {
  expect(sectionForKeyPath("sources.0.kind")).toBe("taskSources");
});

test("defaults.hooks routes to hooks (more specific than bare hooks)", () => {
  expect(sectionForKeyPath("defaults.hooks.prepareWorktree")).toBe("hooks");
});

test("logging routes to advanced", () => {
  expect(sectionForKeyPath("logging.file")).toBe("advanced");
});

test("bare git routes to git", () => {
  expect(sectionForKeyPath("git.remote")).toBe("git");
});

test("a key whose first segment merely starts with a prefix does NOT match", () => {
  // 'linear' must not match 'defaultLinearFoo' — the prefix table is a
  // segment-boundary match, not a substring match.
  expect(sectionForKeyPath("defaultLinearFoo")).toBeUndefined();
});

test("a segment that starts with a prefix but doesn't end at a boundary does NOT match", () => {
  // 'git' must not match the 'gitConfig' segment — the prefix has to abut
  // a `.`/`[` (or end-of-path) on the right too.
  expect(sectionForKeyPath("foo.gitConfig.url")).toBeUndefined();
});

test("an unknown key path returns undefined", () => {
  expect(sectionForKeyPath("totally.unknown.path")).toBeUndefined();
});
