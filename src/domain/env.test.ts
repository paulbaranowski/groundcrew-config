import { expect, test } from "vitest";
import { linearApiKeyStatus } from "./env.ts";

test("reports not-set for an empty environment", () => {
  expect(linearApiKeyStatus({})).toEqual({ set: false });
});

test("prefers GROUNDCREW_LINEAR_API_KEY over LINEAR_API_KEY", () => {
  expect(
    linearApiKeyStatus({ GROUNDCREW_LINEAR_API_KEY: "x", LINEAR_API_KEY: "y" }),
  ).toEqual({ set: true, source: "GROUNDCREW_LINEAR_API_KEY" });
});

test("falls back to LINEAR_API_KEY", () => {
  expect(linearApiKeyStatus({ LINEAR_API_KEY: "y" })).toEqual({
    set: true,
    source: "LINEAR_API_KEY",
  });
});

test("treats an empty string as not set", () => {
  expect(linearApiKeyStatus({ LINEAR_API_KEY: "" })).toEqual({ set: false });
});

test("treats a whitespace-only value as not set", () => {
  expect(linearApiKeyStatus({ LINEAR_API_KEY: "   " })).toEqual({ set: false });
});
