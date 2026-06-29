import { expect, test } from "vitest";
import { listPackagedPrompts, parseFrontmatter } from "./loader.ts";

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

test("parseFrontmatter keeps colons that appear inside the value", () => {
  const text = "---\ndescription: ratio 1:2:3\n---\nbody";
  const { frontmatter } = parseFrontmatter(text);
  expect(frontmatter.description).toBe("ratio 1:2:3");
});

test("listPackagedPrompts surfaces the bundled autonomous prompt", () => {
  const prompts = listPackagedPrompts();
  const autonomous = prompts.find((p) => p.slug === "autonomous");
  expect(autonomous).toBeDefined();
  expect(autonomous?.title).toBe("Autonomous task → PR");
  expect(autonomous?.description).toMatch(/autonomously/);
  // Frontmatter should not leak into the body that gets installed.
  expect(autonomous?.body.startsWith("---")).toBe(false);
  expect(autonomous?.body).toContain("# Autonomous task → PR prompt");
});
