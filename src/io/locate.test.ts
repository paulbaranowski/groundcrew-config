import path from "node:path";
import { expect, test } from "vitest";
import { locate } from "./locate.ts";
import { xdgConfigDir } from "../domain/xdg.ts";

test("defaults to local scope in cwd", () => {
  const r = locate([], "/work");
  expect(r).toEqual({
    target: { scope: "local", cwd: "/work" },
    path: "/work/crew.config.json",
  });
});

test("--global resolves to the XDG path", () => {
  const r = locate(["--global"], "/work");
  expect(r.target.scope).toBe("global");
  expect(r.path).toBe(path.join(xdgConfigDir(), "crew.config.json"));
});

test("an explicit path overrides scope", () => {
  const r = locate(["/etc/crew.config.json"], "/work");
  expect(r.path).toBe("/etc/crew.config.json");
});
