import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import type { CatalogSource } from "../domain/manifestSources.ts";
import { ManifestSourceForm } from "./ManifestSourceForm.tsx";

const base = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
} as never;

const enabledDraft = {
  workspace: { projectDir: "~/d", knownRepositories: [] },
  sources: [{ kind: "jira" }],
} as never;

const jira: CatalogSource = {
  name: "jira",
  description: "Feed JIRA issues into groundcrew via the jira CLI.",
  origin: "package",
  requiresCredentials: true,
  manifest: {
    name: "jira",
    installDir: "~/.config/groundcrew",
    prerequisites: [
      { bin: "jira", install: "brew install jira-cli", setup: "jira init" },
      { bin: "jq", install: "brew install jq" },
    ],
    secrets: [
      {
        env: "JIRA_API_TOKEN",
        file: "jira.token",
        url: "https://id.atlassian.com/tokens",
      },
    ],
    env: { JIRA_STATE_DONE: "Done" },
  },
};

const noProbes = {
  probeBin: () => false,
  probeSecret: () => false,
  env: {},
};

test("renders description, missing prerequisites with install hints, missing secret", () => {
  const { lastFrame } = render(
    <ManifestSourceForm
      source={jira}
      draft={base}
      baseline={base}
      onChange={() => {}}
      onBack={() => {}}
      {...noProbes}
    />,
  );
  const frame = lastFrame() ?? "";
  expect(frame).toContain("jira");
  expect(frame).toContain("Feed JIRA issues");
  expect(frame).toContain("disabled");
  expect(frame).toContain("brew install jira-cli");
  expect(frame).toContain("jira init");
  expect(frame).toContain("brew install jq");
  expect(frame).toContain("JIRA_API_TOKEN");
  expect(frame).toContain("https://id.atlassian.com/tokens");
});

test("found prerequisites and secret render as detected, hiding install hints", () => {
  const { lastFrame } = render(
    <ManifestSourceForm
      source={jira}
      draft={base}
      baseline={base}
      onChange={() => {}}
      onBack={() => {}}
      probeBin={() => true}
      probeSecret={() => true}
      env={{}}
    />,
  );
  const frame = lastFrame() ?? "";
  expect(frame).not.toContain("brew install");
  expect(frame).not.toContain("https://id.atlassian.com/tokens");
});

test("a secret provided via the environment counts as found", () => {
  const { lastFrame } = render(
    <ManifestSourceForm
      source={jira}
      draft={base}
      baseline={base}
      onChange={() => {}}
      onBack={() => {}}
      probeBin={() => true}
      probeSecret={() => false}
      env={{ JIRA_API_TOKEN: "tok" }}
    />,
  );
  expect(lastFrame()).not.toContain("https://id.atlassian.com/tokens");
});

test("space enables the source with a bare kind entry", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <ManifestSourceForm
      source={jira}
      draft={base}
      baseline={base}
      onChange={onChange}
      onBack={() => {}}
      {...noProbes}
    />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [{ kind: "jira" }] }),
  );
});

test("space on an enabled source removes the bare entry", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <ManifestSourceForm
      source={jira}
      draft={enabledDraft}
      baseline={enabledDraft}
      onChange={onChange}
      onBack={() => {}}
      {...noProbes}
    />,
  );
  stdin.write(" ");
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sources: [] }),
  );
});

test("shows manifest env defaults and opens the env override editor", async () => {
  const { lastFrame, stdin } = render(
    <ManifestSourceForm
      source={jira}
      draft={enabledDraft}
      baseline={enabledDraft}
      onChange={() => {}}
      onBack={() => {}}
      {...noProbes}
    />,
  );
  expect(lastFrame()).toContain("JIRA_STATE_DONE=Done");
  stdin.write("[B"); // down to the env row
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ env overrides"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Environment variables"),
  );
});

test("esc calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <ManifestSourceForm
      source={jira}
      draft={base}
      baseline={base}
      onChange={() => {}}
      onBack={onBack}
      {...noProbes}
    />,
  );
  stdin.write("");
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});
