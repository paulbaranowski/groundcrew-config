import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type EditResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

interface Options {
  editorCommand?: string;
}

function resolveEditor(override?: string): string {
  return override ?? process.env.VISUAL ?? process.env.EDITOR ?? "vi";
}

export async function editJson(
  value: unknown,
  options: Options = {},
): Promise<EditResult> {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-edit-"));
  const file = path.join(dir, "section.json");
  writeFileSync(file, `${JSON.stringify(value, undefined, 2)}\n`);

  // Run through a shell (the conventional $EDITOR/$VISUAL contract — git does
  // the same) so editor commands carrying flags ("code --wait") or paths with
  // spaces work. Both inputs are trusted: the editor command is the user's own
  // environment, and the temp path is mkdtemp-generated (no shell metachars).
  const editorCommand = resolveEditor(options.editorCommand);
  // Single-quote the temp path: unlike "..." it suppresses $-/backtick
  // expansion. The path is mkdtemp-generated (no single quotes), so this is safe.
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(`${editorCommand} '${file}'`, {
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve(code ?? 0));
  });
  if (exitCode !== 0)
    return { ok: false, error: `editor exited with code ${exitCode}` };

  try {
    return { ok: true, value: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${(error as Error).message}` };
  }
}
