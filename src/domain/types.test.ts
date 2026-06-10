import { expect, test } from "vitest";
import { RUNNERS, WORKSPACE_KINDS, type ConfigDraft, type SectionId } from "./types.ts";

test("enum lists match groundcrew's accepted values", () => {
  expect(RUNNERS).toEqual(["auto", "safehouse", "srt", "sdx", "none"]);
  expect(WORKSPACE_KINDS).toEqual(["auto", "cmux", "tmux", "zellij"]);
});

test("SectionId is assignable for a known section", () => {
  const id: SectionId = "workspace";
  expect(id).toBe("workspace");
});

test("ConfigDraft requires workspace", () => {
  const draft: ConfigDraft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  };
  expect(draft.workspace.projectDir).toBe("~/dev");
});
