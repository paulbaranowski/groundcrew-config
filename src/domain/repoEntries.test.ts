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
