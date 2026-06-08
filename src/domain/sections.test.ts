import { expect, test } from "vitest";
import {
  SECTION_ORDER,
  sectionSummary,
  simpleSectionSpec,
} from "./sections.ts";

test("section order is the Home list order", () => {
  expect(SECTION_ORDER).toEqual([
    "workspace",
    "models",
    "linear",
    "ticketSources",
    "orchestrator",
    "hooks",
    "git",
    "sandbox",
    "prompts",
    "advanced",
  ]);
});

test("workspace summary shows projectDir and repo count", () => {
  expect(
    sectionSummary("workspace", {
      workspace: {
        projectDir: "~/dev/groundcrew",
        knownRepositories: ["a/b", "c/d"],
      },
    } as never),
  ).toBe("~/dev/groundcrew · 2 repos");
});

test("orchestrator summary shows ghosted defaults when unset", () => {
  expect(
    sectionSummary("orchestrator", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
    } as never),
  ).toBe("max 4 · poll 120s · limit 85%");
});

test("ticketSources summary pluralizes the shell count", () => {
  expect(
    sectionSummary("ticketSources", {
      workspace: { projectDir: "~/d", knownRepositories: [] },
      sources: [
        { kind: "shell", name: "a" },
        { kind: "shell", name: "b" },
      ],
    } as never),
  ).toBe("2 shells");
});

test("sandbox is a select field spec over the runner enum", () => {
  const spec = simpleSectionSpec("sandbox");
  expect(spec[0]?.kind).toBe("select");
  expect(spec[0]?.options).toEqual(["auto", "safehouse", "sdx", "none"]);
});
