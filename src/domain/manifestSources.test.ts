import { expect, test } from "vitest";
import {
  hubRows,
  isKindEnabled,
  readKindEnv,
  readKindEnvWithDefaults,
  setKindEnabled,
  writeKindEnv,
  writeKindEnvAgainstDefaults,
  type CatalogSource,
} from "./manifestSources.ts";
import type { ConfigDraft } from "./types.ts";

const base = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
} as never;

function draftWith(sources: unknown[]): ConfigDraft {
  return {
    workspace: { projectDir: "~/d", knownRepositories: [] },
    sources,
  } as never;
}

const jiraCatalog: CatalogSource = {
  name: "jira",
  description: "Feed JIRA issues into groundcrew via the jira CLI.",
  origin: "package",
  requiresCredentials: true,
  manifest: {
    name: "jira",
    installDir: "~/.config/groundcrew",
    prerequisites: [{ bin: "jira", install: "brew install jira-cli" }],
    secrets: [{ env: "JIRA_API_TOKEN", file: "jira.token" }],
    env: { JIRA_STATE_DONE: "Done" },
  },
};

test("isKindEnabled is false with no entry and true once enabled", () => {
  expect(isKindEnabled(base, "jira")).toBe(false);
  const on = setKindEnabled(base, "jira", true);
  expect(on.sources).toEqual([{ kind: "jira" }]);
  expect(isKindEnabled(on, "jira")).toBe(true);
});

test("an enabled:false entry reads as disabled", () => {
  const draft = draftWith([{ kind: "jira", enabled: false }]);
  expect(isKindEnabled(draft, "jira")).toBe(false);
});

test("toggle-off removes a bare entry entirely (minimal config)", () => {
  const draft = draftWith([{ kind: "jira" }, { kind: "linear" }]);
  const off = setKindEnabled(draft, "jira", false);
  expect(off.sources).toEqual([{ kind: "linear" }]);
});

test("toggle-off keeps a customized entry, marking it enabled:false", () => {
  const draft = draftWith([{ kind: "jira", env: { JIRA_STATE_DONE: "Closed" } }]);
  const off = setKindEnabled(draft, "jira", false);
  expect(off.sources).toEqual([
    { kind: "jira", env: { JIRA_STATE_DONE: "Closed" }, enabled: false },
  ]);
});

test("toggle-on revives a disabled entry, preserving its other keys", () => {
  const draft = draftWith([
    { kind: "jira", env: { JIRA_STATE_DONE: "Closed" }, enabled: false },
  ]);
  const on = setKindEnabled(draft, "jira", true);
  expect(on.sources).toEqual([
    { kind: "jira", env: { JIRA_STATE_DONE: "Closed" } },
  ]);
  expect(isKindEnabled(on, "jira")).toBe(true);
});

test("readKindEnv reads the entry's env as ordered entries", () => {
  const draft = draftWith([
    { kind: "jira", env: { A: "1", B: "2" } },
    { kind: "linear" },
  ]);
  expect(readKindEnv(draft, "jira")).toEqual([
    { key: "A", value: "1" },
    { key: "B", value: "2" },
  ]);
  expect(readKindEnv(base, "jira")).toEqual([]);
});

test("writeKindEnv collapses entries onto the env record", () => {
  const draft = draftWith([{ kind: "jira" }]);
  const next = writeKindEnv(draft, "jira", [
    { key: "A", value: "1" },
    { key: " ", value: "dropped" },
    { key: "A", value: "2" },
  ]);
  expect(next.sources).toEqual([{ kind: "jira", env: { A: "2" } }]);
});

test("writeKindEnv with no surviving entries removes the env key", () => {
  const draft = draftWith([{ kind: "jira", env: { A: "1" } }]);
  const next = writeKindEnv(draft, "jira", []);
  expect(next.sources).toEqual([{ kind: "jira" }]);
});

test("writeKindEnv without a matching entry leaves the draft unchanged", () => {
  const next = writeKindEnv(base, "jira", [{ key: "A", value: "1" }]);
  expect(next.sources ?? []).toEqual([]);
});

const jiraDefaults = {
  JIRA_STATE_IN_PROGRESS: "In Progress",
  JIRA_STATE_IN_REVIEW: "In Review",
  JIRA_STATE_DONE: "Done",
};

test("readKindEnvWithDefaults seeds the manifest defaults in order when no overrides", () => {
  const draft = draftWith([{ kind: "jira" }]);
  expect(readKindEnvWithDefaults(draft, "jira", jiraDefaults)).toEqual([
    { key: "JIRA_STATE_IN_PROGRESS", value: "In Progress" },
    { key: "JIRA_STATE_IN_REVIEW", value: "In Review" },
    { key: "JIRA_STATE_DONE", value: "Done" },
  ]);
  // No entry at all still surfaces the defaults for a to-be-enabled source.
  expect(readKindEnvWithDefaults(base, "jira", jiraDefaults)).toEqual([
    { key: "JIRA_STATE_IN_PROGRESS", value: "In Progress" },
    { key: "JIRA_STATE_IN_REVIEW", value: "In Review" },
    { key: "JIRA_STATE_DONE", value: "Done" },
  ]);
});

test("readKindEnvWithDefaults overlays overrides and appends extra keys after defaults", () => {
  const draft = draftWith([
    {
      kind: "jira",
      env: { JIRA_STATE_IN_REVIEW: "Reviewing", JIRA_GROUNDCREW_JQL: "labels = gc" },
    },
  ]);
  expect(readKindEnvWithDefaults(draft, "jira", jiraDefaults)).toEqual([
    { key: "JIRA_STATE_IN_PROGRESS", value: "In Progress" },
    { key: "JIRA_STATE_IN_REVIEW", value: "Reviewing" },
    { key: "JIRA_STATE_DONE", value: "Done" },
    { key: "JIRA_GROUNDCREW_JQL", value: "labels = gc" },
  ]);
});

test("writeKindEnvAgainstDefaults persists only entries that differ from defaults", () => {
  const draft = draftWith([{ kind: "jira" }]);
  const edited = readKindEnvWithDefaults(draft, "jira", jiraDefaults).map((e) =>
    e.key === "JIRA_STATE_IN_REVIEW" ? { ...e, value: "Reviewing" } : e,
  );
  const next = writeKindEnvAgainstDefaults(draft, "jira", edited, jiraDefaults);
  expect(next.sources).toEqual([
    { kind: "jira", env: { JIRA_STATE_IN_REVIEW: "Reviewing" } },
  ]);
});

test("writeKindEnvAgainstDefaults keeps non-default keys and drops blanks", () => {
  const draft = draftWith([{ kind: "jira" }]);
  const next = writeKindEnvAgainstDefaults(
    draft,
    "jira",
    [
      { key: "JIRA_STATE_DONE", value: "Done" }, // equals default → dropped
      { key: "JIRA_GROUNDCREW_JQL", value: "labels = gc" }, // not a default → kept
      { key: "  ", value: "blank" }, // blank key → dropped
    ],
    jiraDefaults,
  );
  expect(next.sources).toEqual([
    { kind: "jira", env: { JIRA_GROUNDCREW_JQL: "labels = gc" } },
  ]);
});

test("writeKindEnvAgainstDefaults writes nothing when every entry matches its default", () => {
  const draft = draftWith([{ kind: "jira" }]);
  const untouched = readKindEnvWithDefaults(draft, "jira", jiraDefaults);
  const next = writeKindEnvAgainstDefaults(draft, "jira", untouched, jiraDefaults);
  expect(next.sources).toEqual([{ kind: "jira" }]);
});

test("hubRows with an empty catalog yields the four static rows", () => {
  const rows = hubRows([], base, base);
  expect(rows.map((r) => r.label)).toEqual([
    "Linear",
    "todo-txt",
    "PlanKeeper",
    "Shell sources",
  ]);
});

test("hubRows inserts discovered sources after the builtins, alphabetically", () => {
  const zendesk: CatalogSource = {
    name: "zendesk",
    description: "z",
    origin: "user",
    requiresCredentials: false,
  };
  const rows = hubRows([zendesk, jiraCatalog], base, base);
  expect(rows.map((r) => r.label)).toEqual([
    "Linear",
    "todo-txt",
    "jira",
    "zendesk",
    "PlanKeeper",
    "Shell sources",
  ]);
  const jiraRow = rows[2];
  expect(jiraRow?.route).toEqual({ screen: "manifest", source: jiraCatalog });
  expect(jiraRow?.status).toBe("disabled");
});

test("hubRows skips builtin catalog entries (they already have bespoke rows)", () => {
  const linearEntry: CatalogSource = {
    name: "linear",
    description: "Linear",
    origin: "builtin",
    requiresCredentials: true,
  };
  const rows = hubRows([linearEntry], base, base);
  expect(rows.map((r) => r.label)).toEqual([
    "Linear",
    "todo-txt",
    "PlanKeeper",
    "Shell sources",
  ]);
});

test("hubRows reports enabled status and modified flag for discovered rows", () => {
  const draft = draftWith([{ kind: "jira" }]);
  const rows = hubRows([jiraCatalog], draft, base);
  const jiraRow = rows.find((r) => r.label === "jira");
  expect(jiraRow?.status).toBe("enabled");
  expect(jiraRow?.modified).toBe(true);
  const settled = hubRows([jiraCatalog], draft, draft);
  expect(settled.find((r) => r.label === "jira")?.modified).toBe(false);
});
