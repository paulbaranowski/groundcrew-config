import { expect, test } from "vitest";
import { validateDraft } from "./validate.ts";

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
