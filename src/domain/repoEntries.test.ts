import { expect, test } from "vitest";
import {
  denormalizeRepos,
  duplicateEntry,
  normalizeRepos,
  repoErrors,
  uniqueRepoName,
  type RepoEntry,
} from "./repoEntries.ts";

test("normalizes mixed union to uniform entries", () => {
  expect(
    normalizeRepos(["a/b", { name: "c/d", projectDirOverride: "~/work" }]),
  ).toEqual([
    { name: "a/b", projectDirOverride: undefined },
    { name: "c/d", projectDirOverride: "~/work" },
  ]);
});

test("denormalizes to bare string when no override", () => {
  const entries: RepoEntry[] = [
    { name: "a/b", projectDirOverride: undefined },
    { name: "c/d", projectDirOverride: "~/work" },
  ];
  expect(denormalizeRepos(entries)).toEqual([
    "a/b",
    { name: "c/d", projectDirOverride: "~/work" },
  ]);
});

test("denormalize drops a whitespace-only override", () => {
  expect(
    denormalizeRepos([{ name: "a/b", projectDirOverride: "   " }]),
  ).toEqual(["a/b"]);
});

test("round-trips workdir and provision through normalize/denormalize", () => {
  const union = [
    { name: "a/b", workdir: "service" },
    {
      name: "c/d",
      provision: { create: "graft add ${name}", remove: "graft rm ${name}" },
    },
  ];
  const entries = normalizeRepos(union);
  expect(entries).toEqual([
    {
      name: "a/b",
      projectDirOverride: undefined,
      workdir: "service",
      provision: undefined,
    },
    {
      name: "c/d",
      projectDirOverride: undefined,
      workdir: undefined,
      provision: { create: "graft add ${name}", remove: "graft rm ${name}" },
    },
  ]);
  expect(denormalizeRepos(entries)).toEqual(union);
});

test("editing one repo preserves workdir/provision on the others", () => {
  // Reproduces the data-loss bug: rebuilding the array from RepoEntry must not
  // strip per-repo fields from untouched entries.
  const entries = normalizeRepos([
    { name: "a/b", workdir: "service" },
    {
      name: "c/d",
      provision: { create: "graft add", remove: "graft rm" },
    },
  ]);
  const edited = [...entries];
  edited[0] = { ...entries[0]!, name: "a/renamed" };
  expect(denormalizeRepos(edited)).toEqual([
    { name: "a/renamed", workdir: "service" },
    { name: "c/d", provision: { create: "graft add", remove: "graft rm" } },
  ]);
});

test("denormalize keeps both provision keys even when one is blank", () => {
  // pruneEmpty later strips the blank one so groundcrew's loader reports the
  // both-required error, rather than us silently discarding what was typed.
  expect(
    denormalizeRepos([
      { name: "a/b", projectDirOverride: undefined, provision: { create: "x", remove: "  " } },
    ]),
  ).toEqual([{ name: "a/b", provision: { create: "x", remove: "" } }]);
});

test("flags duplicates across names that differ only by surrounding whitespace", () => {
  const errors = repoErrors([
    { name: "a/b", projectDirOverride: undefined },
    { name: " a/b ", projectDirOverride: undefined },
  ]);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toMatch(/duplicate/i);
});

test("flags duplicate names and empty names", () => {
  const entries: RepoEntry[] = [
    { name: "a/b", projectDirOverride: undefined },
    { name: "a/b", projectDirOverride: undefined },
    { name: "", projectDirOverride: undefined },
  ];
  const errors = repoErrors(entries);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toMatch(/duplicate/i);
  expect(errors[2]).toMatch(/name is required/i);
});

test("flags projectDirOverride combined with provision (matches groundcrew)", () => {
  const errors = repoErrors([
    {
      name: "catalog-tools-api",
      projectDirOverride: "~/carrot",
      workdir: "catalog/catalog-tools-api",
      provision: { create: "graft", remove: "graft" },
    },
  ]);
  expect(errors[0]).toMatch(/projectDirOverride.*provision/i);
});

test("a provision-only or override-only entry is clean", () => {
  const errors = repoErrors([
    {
      name: "maple",
      projectDirOverride: undefined,
      provision: { create: "graft new", remove: "graft rm" },
    },
    { name: "catalog-tools-api", projectDirOverride: "~/carrot" },
  ]);
  expect(errors[0]).toBeUndefined();
  expect(errors[1]).toBeUndefined();
});

test("uniqueRepoName returns the base name when it is free", () => {
  expect(uniqueRepoName("a/b", ["c/d"])).toBe("a/b");
});

test("uniqueRepoName appends -copy, then -copy-2, -copy-3 when taken", () => {
  expect(uniqueRepoName("a/b", ["a/b"])).toBe("a/b-copy");
  expect(uniqueRepoName("a/b", ["a/b", "a/b-copy"])).toBe("a/b-copy-2");
  expect(uniqueRepoName("a/b", ["a/b", "a/b-copy", "a/b-copy-2"])).toBe(
    "a/b-copy-3",
  );
});

test("uniqueRepoName skips an already-taken intermediate suffix", () => {
  // -copy-2 is free even though -copy and -copy-3 are taken: take the first gap.
  expect(uniqueRepoName("a/b", ["a/b", "a/b-copy", "a/b-copy-3"])).toBe(
    "a/b-copy-2",
  );
});

test("duplicateEntry deep-copies all fields and assigns a unique name", () => {
  const original: RepoEntry = {
    name: "c/d",
    projectDirOverride: undefined,
    workdir: "service",
    provision: { create: "graft add ${name}", remove: "graft rm ${name}" },
  };
  const copy = duplicateEntry(original, ["c/d"]);
  expect(copy).toEqual({
    name: "c/d-copy",
    projectDirOverride: undefined,
    workdir: "service",
    provision: { create: "graft add ${name}", remove: "graft rm ${name}" },
  });
  // Deep copy: mutating the copy's provision must not touch the original's.
  copy.provision!.create = "changed";
  expect(original.provision!.create).toBe("graft add ${name}");
});

test("round-trips per-repo hooks.prepareWorktree through normalize/denormalize", () => {
  const union = [
    {
      name: "other-org/their-repo",
      hooks: { prepareWorktree: "uv sync --dev --frozen" },
    },
  ];
  const entries = normalizeRepos(union);
  expect(entries).toEqual([
    {
      name: "other-org/their-repo",
      projectDirOverride: undefined,
      workdir: undefined,
      provision: undefined,
      prepareWorktreeHook: "uv sync --dev --frozen",
    },
  ]);
  expect(denormalizeRepos(entries)).toEqual(union);
});

test("denormalize drops a whitespace-only prepareWorktreeHook and stays bare-string", () => {
  expect(
    denormalizeRepos([
      { name: "a/b", projectDirOverride: undefined, prepareWorktreeHook: "   " },
    ]),
  ).toEqual(["a/b"]);
});

test("denormalize combines hooks with workdir on the same object entry", () => {
  expect(
    denormalizeRepos([
      {
        name: "billing",
        projectDirOverride: undefined,
        workdir: "services/billing",
        prepareWorktreeHook: "uv sync --dev --frozen",
      },
    ]),
  ).toEqual([
    {
      name: "billing",
      workdir: "services/billing",
      hooks: { prepareWorktree: "uv sync --dev --frozen" },
    },
  ]);
});

test("duplicateEntry carries the per-repo hook to the copy", () => {
  const original: RepoEntry = {
    name: "billing",
    projectDirOverride: undefined,
    prepareWorktreeHook: "uv sync --dev --frozen",
  };
  expect(duplicateEntry(original, ["billing"])).toEqual({
    name: "billing-copy",
    projectDirOverride: undefined,
    workdir: undefined,
    provision: undefined,
    prepareWorktreeHook: "uv sync --dev --frozen",
  });
});

test("a duplicated scripted entry keeps both provision templates on save", () => {
  const original: RepoEntry = {
    name: "maple",
    projectDirOverride: undefined,
    provision: { create: "graft add maple", remove: "graft rm maple" },
  };
  const copy = duplicateEntry(original, ["maple"]);
  expect(denormalizeRepos([original, copy])).toEqual([
    { name: "maple", provision: { create: "graft add maple", remove: "graft rm maple" } },
    {
      name: "maple-copy",
      provision: { create: "graft add maple", remove: "graft rm maple" },
    },
  ]);
});
