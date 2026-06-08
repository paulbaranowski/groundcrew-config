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

  const [command, ...fixedArgs] = resolveEditor(options.editorCommand).split(
    " ",
  );
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(command ?? "vi", [...fixedArgs, file], {
      stdio: "inherit",
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
