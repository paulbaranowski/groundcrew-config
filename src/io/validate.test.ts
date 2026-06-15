import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { mapSection, validateDraft } from "./validate.ts";

test("mapSection maps a workspace.projectDir error to workspace", () => {
  expect(
    mapSection("groundcrew config: workspace.projectDir must be non-empty"),
  ).toBe("workspace");
});

test("mapSection maps knownRepositories errors to repositories", () => {
  expect(mapSection("workspace.knownRepositories[0] must be a string")).toBe(
    "repositories",
  );
});

test("mapSection maps workspaceKind errors to terminal", () => {
  expect(mapSection("workspaceKind must be one of auto, cmux, tmux")).toBe(
    "terminal",
  );
});

test("mapSection maps usage errors to usage", () => {
  expect(mapSection("agents.definitions.claude.usage is invalid")).toBe(
    "usage",
  );
});

test("mapSection routes the session limit to usage, other orchestrator keys to orchestrator", () => {
  // sessionLimitPercentage is edited on the Usage Limits screen, so its error
  // badge follows the field, not its orchestrator.* config path.
  expect(
    mapSection(
      "groundcrew config: orchestrator.sessionLimitPercentage must be a finite number in (0, 100]",
    ),
  ).toBe("usage");
  expect(
    mapSection("groundcrew config: orchestrator.maximumInProgress must be an integer ≥ 1"),
  ).toBe("orchestrator");
});

test("mapSection routes through groundcrew 4.x's file-path-prefixed format", () => {
  // groundcrew's loader wraps the original validation error with the absolute
  // config filepath: "groundcrew config: <filepath>: <key.path> <prose>". The
  // routing has to skip that prefix and still reach the key path.
  expect(
    mapSection(
      "groundcrew config: /tmp/cc-validate-x/.crew.config.validate-abc.json: workspace.projectDir must be a non-empty string (got undefined)",
    ),
  ).toBe("workspace");
});

test("mapSection strips a Windows drive-letter path prefix", () => {
  expect(
    mapSection(
      "groundcrew config: C:\\Users\\me\\.config\\groundcrew\\crew.config.json: workspace.projectDir must be a non-empty string (got undefined)",
    ),
  ).toBe("workspace");
});

test("mapSection strips a path prefix containing spaces", () => {
  // groundcrew's wrapped error format keeps the absolute file path verbatim;
  // a config under e.g. ~/Library/Application Support/... means the path itself
  // contains spaces. The strip regex must still find the path/keypath boundary.
  expect(
    mapSection(
      "groundcrew config: /Users/me/My Configs/crew.config.json: workspace.projectDir must be a non-empty string (got undefined)",
    ),
  ).toBe("workspace");
});

test("mapSection maps a prompts.initial error to prompts even when its prose names other sections", () => {
  // groundcrew lists allowed placeholders in the message, one of which is
  // {{workspaceContinuationInstruction}}. The badge must follow the key path
  // (prompts.initial), not a section keyword buried in the prose.
  expect(
    mapSection(
      'groundcrew config: prompts.initial contains unknown placeholder "{{ticket}}". Allowed placeholders: {{task}}, {{worktree}}, {{title}}, {{description}}, {{workspaceContinuationInstruction}}',
    ),
  ).toBe("prompts");
});

test("a complete config validates ok", async () => {
  const result = await validateDraft({
    workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
    agents: { default: "claude", definitions: { claude: {} } },
  } as never);
  expect(result.ok).toBe(true);
});

test("a missing projectDir fails and maps to the workspace section", async () => {
  const result = await validateDraft({
    workspace: { knownRepositories: [] },
  } as never);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.message).toMatch(/workspace/i);
    expect(result.section).toBe("workspace");
  }
});

test("a relative promptFile validates against the config's real directory", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-validate-test-"));
  try {
    writeFileSync(path.join(dir, "prompt.md"), "Do the task {{task}}.");
    const draft = {
      workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
      agents: { default: "claude", definitions: { claude: {} } },
      prompts: { promptFile: "prompt.md" },
    } as never;
    // Resolved in the config's real dir, the sibling file is found -> ok.
    expect((await validateDraft(draft, dir)).ok).toBe(true);
    // Without the dir, groundcrew resolves the relative path against a throwaway
    // temp dir where the file is absent -> a false failure routed to prompts.
    const stray = await validateDraft(draft);
    expect(stray.ok).toBe(false);
    if (!stray.ok) expect(stray.section).toBe("prompts");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validation leaves no sidecar behind in the config directory", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-validate-test-"));
  try {
    await validateDraft(
      {
        workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
        agents: { default: "claude", definitions: { claude: {} } },
      } as never,
      dir,
    );
    expect(readdirSync(dir)).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
