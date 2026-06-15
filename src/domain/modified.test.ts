import { expect, test } from "vitest";
import type { ConfigDraft } from "./types.ts";
import { modifiedByKey, modifiedSections } from "./modified.ts";

const baseline = {
  workspace: { projectDir: "~/dev", knownRepositories: ["a", "b"] },
  agents: { default: "claude", definitions: { claude: {} } },
  git: { remote: "origin", defaultBranch: "main" },
} as unknown as ConfigDraft;

test("modifiedSections: identical drafts -> empty set", () => {
  expect(modifiedSections(baseline, baseline).size).toBe(0);
});

test("modifiedSections: a git.remote change routes to git", () => {
  const draft = {
    ...baseline,
    git: { ...baseline.git, remote: "upstream" },
  } as ConfigDraft;
  expect([...modifiedSections(baseline, draft)]).toEqual(["git"]);
});

test("modifiedSections: changing knownRepositories routes to repositories", () => {
  const draft = {
    ...baseline,
    workspace: { ...baseline.workspace, knownRepositories: ["a", "b", "c"] },
  } as ConfigDraft;
  expect([...modifiedSections(baseline, draft)]).toEqual(["repositories"]);
});

test("modifiedSections: a source change routes to taskSources", () => {
  const draft = {
    ...baseline,
    sources: [{ kind: "linear" as const }],
  } as ConfigDraft;
  expect([...modifiedSections(baseline, draft)]).toEqual(["taskSources"]);
});

test("modifiedSections: multiple unrelated changes are deduped by section", () => {
  const draft = {
    ...baseline,
    git: { ...baseline.git, remote: "upstream", defaultBranch: "dev" },
  } as ConfigDraft;
  // Two git fields changed -> one entry.
  expect([...modifiedSections(baseline, draft)]).toEqual(["git"]);
});

test("modifiedSections: an unrouted path is silently ignored", () => {
  const a = { unknownTopLevel: 1 } as unknown as ConfigDraft;
  const b = { unknownTopLevel: 2 } as unknown as ConfigDraft;
  expect(modifiedSections(a, b).size).toBe(0);
});

test("modifiedByKey: same-key, equal items are not modified", () => {
  const current = [{ name: "a", v: 1 }];
  const base = [{ name: "a", v: 1 }];
  expect(modifiedByKey(current, base, (x) => x.name)).toEqual([false]);
});

test("modifiedByKey: a same-key item with a value change is modified", () => {
  const current = [{ name: "a", v: 2 }];
  const base = [{ name: "a", v: 1 }];
  expect(modifiedByKey(current, base, (x) => x.name)).toEqual([true]);
});

test("modifiedByKey: an added (new-key) item is modified", () => {
  const current = [
    { name: "a", v: 1 },
    { name: "b", v: 1 },
  ];
  const base = [{ name: "a", v: 1 }];
  expect(modifiedByKey(current, base, (x) => x.name)).toEqual([false, true]);
});

test("modifiedByKey: a renamed item is modified (no baseline key matches)", () => {
  const current = [{ name: "a-renamed", v: 1 }];
  const base = [{ name: "a", v: 1 }];
  expect(modifiedByKey(current, base, (x) => x.name)).toEqual([true]);
});

test("modifiedByKey: order does not matter when keys match", () => {
  const current = [
    { name: "b", v: 2 },
    { name: "a", v: 1 },
  ];
  const base = [
    { name: "a", v: 1 },
    { name: "b", v: 2 },
  ];
  expect(modifiedByKey(current, base, (x) => x.name)).toEqual([false, false]);
});

test("modifiedByKey: no baseline at all -> every item is modified", () => {
  expect(modifiedByKey([{ name: "a" }], undefined, (x) => x.name)).toEqual([
    true,
  ]);
});
