import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { editJson } from "./editJson.ts";

test("round-trips a value through a scripted editor that rewrites the file", async () => {
  // Fake editor: a node script that overwrites the target file with new JSON.
  const dir = mkdtempSync(path.join(tmpdir(), "cc-editor-"));
  const editor = path.join(dir, "fake-editor.mjs");
  writeFileSync(
    editor,
    `import { writeFileSync } from "node:fs"; writeFileSync(process.argv[2], JSON.stringify({ edited: true }));`,
  );
  const result = await editJson(
    { kind: "shell", name: "jira" },
    { editorCommand: `${process.execPath} ${editor}` },
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toEqual({ edited: true });
});

test("reports a parse error when the editor leaves invalid json", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-editor-"));
  const editor = path.join(dir, "bad-editor.mjs");
  writeFileSync(
    editor,
    `import { writeFileSync } from "node:fs"; writeFileSync(process.argv[2], "{ not json");`,
  );
  const result = await editJson(
    {},
    { editorCommand: `${process.execPath} ${editor}` },
  );
  expect(result.ok).toBe(false);
});
