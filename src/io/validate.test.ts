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
