// Packaged prompts ship as .md files. In dev the loader file IS in
// `src/prompts/`, so `./` next to this module already lands on them. After
// bundling, this loader is inlined into `dist/cli.js` and the .md files are
// copied into a sibling `dist/prompts/` directory — so the prod resolver needs
// to dive one level into `./prompts/`. We try the bundled location first and
// fall back to the dev one. Each file carries YAML frontmatter with `title:`
// and `description:` lines; the body is the prompt the agent sees.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

export function resolvePromptsDir(moduleUrl: string = import.meta.url): string {
  const bundled = fileURLToPath(new URL("./prompts/", moduleUrl));
  if (existsSync(bundled) && statSync(bundled).isDirectory()) return bundled;
  return fileURLToPath(new URL("./", moduleUrl));
}

// Resolve lazily and memoize: `resolvePromptsDir` touches the filesystem
// (existsSync/statSync), so doing it at module import time would make merely
// importing this module perform disk I/O. Deferring it to the first call keeps
// import side-effect-free; the cache means repeated calls resolve only once.
let cachedPromptsDir: string | undefined;
function defaultPromptsDir(): string {
  return (cachedPromptsDir ??= resolvePromptsDir());
}

export function listPackagedPrompts(
  dir: string = defaultPromptsDir(),
): PackagedPrompt[] {
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
