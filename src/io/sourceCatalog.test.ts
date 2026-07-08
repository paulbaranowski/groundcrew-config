import { expect, test } from "vitest";
import { catalogFromModule, loadSourceCatalog } from "./sourceCatalog.ts";

const jiraEntry = {
  name: "jira",
  description: "Feed JIRA issues into groundcrew via the jira CLI.",
  origin: "package",
  requiresCredentials: true,
};

const jiraManifest = {
  name: "jira",
  kind: "shell",
  description: "Feed JIRA issues into groundcrew via the jira CLI.",
  installDir: "~/.config/groundcrew",
  files: ["jira.sh"],
  prerequisites: [
    { bin: "jira", install: "brew install jira-cli", setup: "jira init" },
    { bin: "jq", install: "brew install jq" },
  ],
  secrets: [
    { env: "JIRA_API_TOKEN", file: "jira.token", mode: "0600", url: "https://x" },
  ],
  env: { JIRA_STATE_DONE: "Done" },
  commands: { verify: "x" },
};

test("joins discovered entries with their manifests", async () => {
  const catalog = await catalogFromModule({
    listTaskSources: async () => [
      { name: "linear", description: "Linear", origin: "builtin", requiresCredentials: true },
      jiraEntry,
    ],
    getTaskSourceManifest: (name: string) =>
      name === "jira" ? jiraManifest : undefined,
  });
  expect(catalog).toHaveLength(2);
  expect(catalog[0]).toEqual({
    name: "linear",
    description: "Linear",
    origin: "builtin",
    requiresCredentials: true,
  });
  expect(catalog[1]?.manifest).toEqual({
    name: "jira",
    description: "Feed JIRA issues into groundcrew via the jira CLI.",
    installDir: "~/.config/groundcrew",
    prerequisites: [
      { bin: "jira", install: "brew install jira-cli", setup: "jira init" },
      { bin: "jq", install: "brew install jq" },
    ],
    secrets: [
      { env: "JIRA_API_TOKEN", file: "jira.token", mode: "0600", url: "https://x" },
    ],
    env: { JIRA_STATE_DONE: "Done" },
  });
});

test("resolves a per-OS install object to the current platform, with a default fallback", async () => {
  const perOs = {
    ...jiraManifest,
    prerequisites: [
      {
        bin: "jira",
        install: { darwin: "brew install jira-cli", linux: "go install jira" },
        setup: "jira init",
      },
      { bin: "jq", install: { default: "install jq somehow" } },
    ],
  };
  const catalog = await catalogFromModule({
    listTaskSources: async () => [jiraEntry],
    getTaskSourceManifest: () => perOs,
  });
  const prereqs = catalog[0]?.manifest?.prerequisites;
  const expectedJira =
    process.platform === "linux"
      ? "go install jira"
      : process.platform === "darwin"
        ? "brew install jira-cli"
        : undefined;
  expect(prereqs?.[0]?.install).toBe(expectedJira);
  // No entry for the current platform falls back to `default`.
  expect(prereqs?.[1]?.install).toBe("install jq somehow");
});

test("drops an install with neither a current-platform entry nor a default", async () => {
  const noMatch = {
    ...jiraManifest,
    prerequisites: [{ bin: "jira", install: { freebsd: "pkg install jira" } }],
  };
  const catalog = await catalogFromModule({
    listTaskSources: async () => [jiraEntry],
    getTaskSourceManifest: () => noMatch,
  });
  expect(catalog[0]?.manifest?.prerequisites[0]?.install).toBeUndefined();
});

test("returns [] when the catalog exports are missing (older groundcrew)", async () => {
  expect(await catalogFromModule({})).toEqual([]);
  expect(await catalogFromModule({ listTaskSources: "not a fn" })).toEqual([]);
});

test("returns [] when listing throws", async () => {
  const catalog = await catalogFromModule({
    listTaskSources: async () => {
      throw new Error("boom");
    },
    getTaskSourceManifest: () => undefined,
  });
  expect(catalog).toEqual([]);
});

test("drops malformed entries and tolerates a missing/throwing manifest lookup", async () => {
  const catalog = await catalogFromModule({
    listTaskSources: async () => [
      { name: 42, description: "bad" },
      { ...jiraEntry, name: "jira" },
    ],
    getTaskSourceManifest: () => {
      throw new Error("boom");
    },
  });
  expect(catalog).toHaveLength(1);
  expect(catalog[0]?.name).toBe("jira");
  expect(catalog[0]?.manifest).toBeUndefined();
});

test("loadSourceCatalog resolves against the real groundcrew without throwing", async () => {
  // The installed groundcrew may or may not export the catalog API; either way
  // this must resolve to an array (possibly empty), never reject.
  const catalog = await loadSourceCatalog();
  expect(Array.isArray(catalog)).toBe(true);
});
