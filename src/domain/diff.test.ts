import { expect, test } from "vitest";
import { changedPaths, valuesEqual } from "./diff.ts";

test("valuesEqual: primitives", () => {
  expect(valuesEqual(1, 1)).toBe(true);
  expect(valuesEqual("a", "a")).toBe(true);
  expect(valuesEqual(undefined, undefined)).toBe(true);
  expect(valuesEqual(null, null)).toBe(true);
  expect(valuesEqual(1, 2)).toBe(false);
  expect(valuesEqual(undefined, null)).toBe(false);
  expect(valuesEqual(0, "")).toBe(false);
});

test("valuesEqual: object key order does not matter", () => {
  expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
});

test("valuesEqual: nested objects compare deeply", () => {
  expect(valuesEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  expect(valuesEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
});

test("valuesEqual: arrays compare by index and length", () => {
  expect(valuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  expect(valuesEqual([1, 2], [2, 1])).toBe(false);
  expect(valuesEqual([1, 2], [1, 2, 3])).toBe(false);
});

test("valuesEqual: array vs object at the same node differ", () => {
  expect(valuesEqual([1], { 0: 1 })).toBe(false);
});

test("valuesEqual: missing key vs explicit undefined are equal", () => {
  expect(valuesEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
});

test("changedPaths: identical objects return no paths", () => {
  expect(changedPaths({ a: 1 }, { a: 1 })).toEqual([]);
});

test("changedPaths: a single scalar diff", () => {
  expect(changedPaths({ a: 1 }, { a: 2 })).toEqual(["a"]);
});

test("changedPaths: nested scalar diffs report leaf paths", () => {
  expect(
    changedPaths(
      { git: { remote: "origin" } },
      { git: { remote: "upstream" } },
    ),
  ).toEqual(["git.remote"]);
});

test("changedPaths: an added key reports the leaf path", () => {
  expect(changedPaths({}, { git: { remote: "origin" } })).toEqual([
    "git.remote",
  ]);
});

test("changedPaths: a removed key reports the leaf path", () => {
  expect(changedPaths({ git: { remote: "origin" } }, {})).toEqual([
    "git.remote",
  ]);
});

test("changedPaths: array element diff uses numeric index", () => {
  expect(
    changedPaths(
      { sources: [{ kind: "linear" }] },
      { sources: [{ kind: "linear", enabled: false }] },
    ),
  ).toEqual(["sources.0.enabled"]);
});

test("changedPaths: differing array length reports the array's path, not deeper", () => {
  // Type mismatch at the array node: emit the node's path and stop descending.
  expect(changedPaths({ items: [1, 2] }, { items: [1, 2, 3] })).toEqual([
    "items",
  ]);
});

test("changedPaths: object vs primitive at the same node emits the node path", () => {
  expect(changedPaths({ a: { b: 1 } }, { a: 1 })).toEqual(["a"]);
});

test("changedPaths: missing key vs explicit undefined yields no diff", () => {
  expect(changedPaths({ a: 1 }, { a: 1, b: undefined })).toEqual([]);
});
