import { expect, test } from "vitest";
import { mapSection, validateDraft } from "./validate.ts";

test("mapSection maps workspaceKind errors to advanced, not workspace", () => {
  expect(mapSection("workspaceKind must be one of auto, cmux, tmux")).toBe(
    "advanced",
  );
});

test("mapSection maps a workspace.projectDir error to workspace", () => {
  expect(
    mapSection("groundcrew config: workspace.projectDir must be non-empty"),
  ).toBe("workspace");
});

test("a complete config validates ok", async () => {
  const result = await validateDraft({
    workspace: { projectDir: "~/dev", knownRepositories: ["a/b"] },
    models: { default: "claude", definitions: { claude: {} } },
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
