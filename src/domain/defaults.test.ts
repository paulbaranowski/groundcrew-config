import { expect, test } from "vitest";
import {
  DEFAULT_INITIAL_PROMPT,
  DEFAULT_PROMPT_FILE,
  defaultDraft,
} from "./defaults.ts";

test("defaultDraft seeds the opinionated macOS defaults", () => {
  expect(defaultDraft()).toEqual({
    workspace: {
      projectDir: "~/groundcrew",
      worktreeDir: "~/groundcrew/workspaces",
      knownRepositories: [],
    },
    agents: {
      default: "claude",
      definitions: { claude: { usage: { disabled: true } } },
    },
    workspaceKind: "tmux",
    local: { runner: "safehouse" },
    prompts: { promptFile: DEFAULT_PROMPT_FILE },
  });
});

test("each call returns a fresh object (no shared mutable state)", () => {
  const a = defaultDraft();
  const b = defaultDraft();
  expect(a).not.toBe(b);
  expect(a.workspace).not.toBe(b.workspace);
});

test("the starter prompt uses only groundcrew's allowed placeholders", () => {
  const allowed = new Set([
    "{{task}}",
    "{{worktree}}",
    "{{title}}",
    "{{description}}",
    "{{workspaceContinuationInstruction}}",
  ]);
  const used = DEFAULT_INITIAL_PROMPT.match(/{{[^{}]*}}/g) ?? [];
  expect(used.length).toBeGreaterThan(0);
  for (const placeholder of used) expect(allowed.has(placeholder)).toBe(true);
});
