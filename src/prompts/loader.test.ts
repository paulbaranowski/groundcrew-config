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
