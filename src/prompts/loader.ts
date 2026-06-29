// Packaged prompts ship as .md files next to this module (src/prompts/ in dev,
// dist/prompts/ after bundling). Each file carries YAML frontmatter with
// `title:` and `description:` lines; the body is the prompt the agent sees.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PackagedPrompt {
  slug: string;
  title: string;
  description: string;
  body: string;
}

export interface Frontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

const PROMPTS_DIR = fileURLToPath(new URL("./", import.meta.url));

export function listPackagedPrompts(dir: string = PROMPTS_DIR): PackagedPrompt[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  return files.map((name) => readPackagedPrompt(path.join(dir, name)));
}

function readPackagedPrompt(filepath: string): PackagedPrompt {
  const raw = readFileSync(filepath, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const slug = path.basename(filepath, ".md");
  return {
    slug,
    title: frontmatter.title ?? slug,
    description: frontmatter.description ?? "",
    body,
  };
}

// Tiny single-purpose parser: enough for "key: value" lines wrapped in `---`
// fences. We deliberately don't pull in a YAML dep — the frontmatter shape is
// fixed and the file authors are us. Accept both LF and CRLF fences so a repo
// checked out with autocrlf=true on Windows still parses correctly.
export function parseFrontmatter(text: string): Frontmatter {
  const fence = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fence) return { frontmatter: {}, body: text };
  const fm = fence[1] ?? "";
  const body = text.slice(fence[0].length);
  const frontmatter: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2];
    if (key === undefined || rawValue === undefined) continue;
    frontmatter[key] = unquote(rawValue.trim());
  }
  return { frontmatter, body };
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}
