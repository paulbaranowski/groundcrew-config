import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import {
  listPackagedPrompts,
  parseFrontmatter,
  resolvePromptsDir,
} from "./loader.ts";

test("parseFrontmatter pulls key/value pairs out of a leading --- block", () => {
  const text = "---\ntitle: Hello\ndescription: A short note.\n---\nbody line 1\nbody line 2\n";
  const { frontmatter, body } = parseFrontmatter(text);
  expect(frontmatter.title).toBe("Hello");
  expect(frontmatter.description).toBe("A short note.");
  expect(body).toBe("body line 1\nbody line 2\n");
});

test("parseFrontmatter strips matching single or double quotes around values", () => {
  const text = `---\ntitle: "Quoted Title"\ndescription: 'em — dash'\n---\nbody`;
  const { frontmatter } = parseFrontmatter(text);
  expect(frontmatter.title).toBe("Quoted Title");
  expect(frontmatter.description).toBe("em — dash");
});

test("parseFrontmatter returns the original text as body when no fence is present", () => {
  const text = "# Just a heading\n\nbody\n";
  const { frontmatter, body } = parseFrontmatter(text);
  expect(frontmatter).toEqual({});
  expect(body).toBe(text);
});

test("parseFrontmatter accepts CRLF line endings (Windows checkout)", () => {
  const text = "---\r\ntitle: Hello\r\ndescription: A short note.\r\n---\r\nbody line\r\n";
  const { frontmatter, body } = parseFrontmatter(text);
  expect(frontmatter.title).toBe("Hello");
  expect(frontmatter.description).toBe("A short note.");
  expect(body).toBe("body line\r\n");
});

test("parseFrontmatter keeps colons that appear inside the value", () => {
  const text = "---\ndescription: ratio 1:2:3\n---\nbody";
  const { frontmatter } = parseFrontmatter(text);
  expect(frontmatter.description).toBe("ratio 1:2:3");
});

test("resolvePromptsDir prefers ./prompts/ when it exists next to the module (bundled cli.js layout)", () => {
  // Simulate dist/ after build: a cli.js at the root, a sibling prompts/ dir
  // with the .md files. The "moduleUrl" we pass is the URL of the cli.js, the
  // way `import.meta.url` would look from inside the bundle.
  const root = mkdtempSync(path.join(tmpdir(), "crew-config-bundled-"));
  const promptsDir = path.join(root, "prompts");
  mkdirSync(promptsDir);
  writeFileSync(path.join(root, "cli.js"), "// bundle\n");
  writeFileSync(path.join(promptsDir, "sample.md"), "---\ntitle: X\n---\nbody\n");
  const moduleUrl = pathToFileURL(path.join(root, "cli.js")).href;
  // Trailing slash so node:path normalizes the same way the loader does.
  expect(resolvePromptsDir(moduleUrl)).toBe(promptsDir + path.sep);
});

test("resolvePromptsDir falls back to the module's directory when no sibling prompts/ exists (dev layout)", () => {
  // Simulate src/prompts/loader.ts: there is no nested prompts/prompts/ dir, so
  // the resolver must return the directory the module itself lives in.
  const root = mkdtempSync(path.join(tmpdir(), "crew-config-dev-"));
  writeFileSync(path.join(root, "loader.js"), "// dev\n");
  writeFileSync(path.join(root, "sample.md"), "---\ntitle: X\n---\nbody\n");
  const moduleUrl = pathToFileURL(path.join(root, "loader.js")).href;
  expect(resolvePromptsDir(moduleUrl)).toBe(root + path.sep);
});

test("listPackagedPrompts surfaces the bundled coding-task prompt", () => {
  const prompts = listPackagedPrompts();
  const autonomous = prompts.find((p) => p.slug === "autonomous");
  expect(autonomous).toBeDefined();
  expect(autonomous?.title).toBe("Coding task → PR");
  expect(autonomous?.description).toMatch(/self-contained/);
  // Frontmatter should not leak into the body that gets installed.
  expect(autonomous?.body.startsWith("---")).toBe(false);
  expect(autonomous?.body).toContain("# Coding task → PR prompt");
});
