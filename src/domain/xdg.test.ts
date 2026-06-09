import { homedir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { xdgConfigDir } from "./xdg.ts";

const original = process.env.XDG_CONFIG_HOME;
afterEach(() => {
  process.env.XDG_CONFIG_HOME = original;
});

test("uses XDG_CONFIG_HOME when set", () => {
  process.env.XDG_CONFIG_HOME = "/tmp/xdg";
  expect(xdgConfigDir()).toBe(path.join("/tmp/xdg", "groundcrew"));
});

test("falls back to ~/.config when unset", () => {
  delete process.env.XDG_CONFIG_HOME;
  expect(xdgConfigDir()).toBe(path.join(homedir(), ".config", "groundcrew"));
});
