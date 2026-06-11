import type { ConfigDraft } from "./types.ts";

/**
 * Filename (relative to the config dir) of the initial-prompt file we ship with
 * a freshly-seeded config. groundcrew resolves `prompts.promptFile` relative to
 * the config dir, so a bare basename is correct here.
 */
export const DEFAULT_PROMPT_FILE = "prompt-initial.md";

/**
 * The starter prompt written to {@link DEFAULT_PROMPT_FILE} for a brand-new
 * config. Mirrors groundcrew's own built-in `DEFAULT_PROMPT_INITIAL` so a fresh
 * setup behaves identically to having no prompt configured — but hands the user
 * an editable file to tune. Only groundcrew's allowed placeholders appear here
 * ({{task}}, {{title}}, {{description}}, {{worktree}},
 * {{workspaceContinuationInstruction}}).
 */
export const DEFAULT_INITIAL_PROMPT = [
  "You are working on task {{task}} ({{title}}) in the {{worktree}} worktree subdirectory.",
  "",
  "## Task description",
  "",
  "<task_description>",
  "{{description}}",
  "</task_description>",
  "",
  "## Operating mode",
  "",
  "There is no human watching this session. Do not stop to ask clarifying questions. When the task is ambiguous or incomplete, choose the simplest reasonable interpretation consistent with the task and the codebase, then document that choice in the output.",
  "{{workspaceContinuationInstruction}}",
  "",
  "## Workflow",
  "",
  "1. Inspect the repo instructions and existing patterns before edits.",
  "2. Implement the smallest sensible change that completes the task.",
  "3. Run the repo's documented verification command. If no documented command exists, run the smallest relevant test suite you can find and fix failures you introduced before continuing.",
  "4. Follow the task description for output. If no output instructions exist, open a PR with `Closes {{task}}` in the description. If you cannot open one, leave the branch ready and record the blocker.",
  "",
].join("\n");

/**
 * The seed draft used when the config file is new/absent. Opinionated macOS
 * defaults: Claude as the only agent (with usage tracking off), the safehouse
 * sandbox, tmux as the terminal, and per-task worktrees collected under
 * ~/groundcrew/workspaces. `projectDir` is required by groundcrew (it must be a
 * non-empty string), so it points at the parent ~/groundcrew while worktrees
 * live in the workspaces subdir. The user still has to add at least one task
 * source and their repositories.
 */
export function defaultDraft(): ConfigDraft {
  return {
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
  } as ConfigDraft;
}
