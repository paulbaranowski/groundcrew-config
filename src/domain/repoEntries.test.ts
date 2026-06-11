import { expect, test } from "vitest";
import {
  denormalizeRepos,
  normalizeRepos,
  repoErrors,
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
