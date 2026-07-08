import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { App } from "./app.tsx";

const DOWN = "\x1b[B"; // down-arrow escape sequence
const ESC = "\x1b";

const draft = {
  workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
  agents: { default: "claude", definitions: { claude: {} } },
} as never;

test("starts on Home when given an existing draft", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("Workspace");
  expect(lastFrame()).toContain("q quit");
  unmount();
});

test("starts on Home with no existing config", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={undefined} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("crew-config");
  expect(lastFrame()).toContain("Workspace");
  unmount();
});

test("shows the no-task-sources warning on Home", () => {
  const { lastFrame, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  expect(lastFrame()).toContain("no task sources");
  unmount();
});

test("enter opens a section, esc returns home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN); // down to Repositories (row 1; Setup is row 0)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write("\r"); // open Repositories
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("repos groundcrew is allowed to work on"),
  );
  stdin.write(ESC); // esc back
  await vi.waitFor(() => expect(lastFrame()).toContain("Task Sources"));
  unmount();
});

test("opens the Setup screen from Home with injected deps", async () => {
  const report = {
    action: "already-installed" as const,
    version: "9.9.9",
    details: "",
  };
  const setupDeps = {
    platform: "darwin",
    probeGroundcrew: () => Promise.resolve(report),
    installGroundcrew: () => Promise.resolve(report),
    probeSafehouse: () => Promise.resolve(report),
    installSafehouse: () => Promise.resolve(report),
    probeClearance: () =>
      Promise.resolve({
        personalFileExists: false,
        personalFileHasClaudeHosts: false,
        envExported: false,
        daemonPid: null,
        daemonAgeSeconds: null,
      }),
    probeSafehouseSetup: () =>
      Promise.resolve({
        binaryAvailable: false,
        binaryPath: null,
        brewFormulaInstalled: false,
        envExported: false,
        sidecarPresent: false,
        sidecarHasFunctions: false,
      }),
    writeHosts: () => ({
      target: "/h/.config/clearance/personal-allow-hosts",
      wrote: true,
      refused: false,
    }),
    writeClearance: () => ({
      target: "/h/.config/clearance/env.sh",
      rcConflicts: [],
      overridesStub: null,
    }),
    writeSafehouse: () => ({
      target: "/h/.config/agent-safehouse/env.sh",
      rcConflicts: [],
      overridesStub: null,
    }),
    runCrewDoctor: () =>
      Promise.resolve({ available: true, code: 0, output: "all good" }),
  };
  const { lastFrame, stdin, unmount } = render(
    <App
      initialDraft={draft}
      target={{ scope: "local", cwd: "/tmp" }}
      setupDeps={setupDeps}
    />,
  );
  stdin.write("\r"); // Setup is row 0
  await vi.waitFor(() => expect(lastFrame()).toContain("9.9.9"));
  stdin.write(ESC);
  await vi.waitFor(() => expect(lastFrame()).toContain("Task Sources"));
  unmount();
});

test("opens the Agents bypass-permissions form from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  // Each waitFor yields a tick so ink processes one queued arrow before the
  // next write. Agents is row 4: Setup, Repositories, Workspace, Task
  // Sources, Agents.
  stdin.write(DOWN); // down to Repositories (row 1)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write(DOWN); // down to Workspace (row 2)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write(DOWN); // down to Task Sources (row 3)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Task Sources"));
  stdin.write(DOWN); // down to Agents (row 4)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Agents"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("bypass permission prompts"),
  );
  unmount();
});

test("esc restores the Home row that was open", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN); // down to Repositories (row 1)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write(DOWN); // down to Workspace (row 2)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write("\r"); // open Workspace
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  stdin.write(ESC); // esc back to Home
  // The cursor must stay on Workspace, not snap back to Repositories.
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  expect(lastFrame()).not.toContain("▸ Repositories");
  unmount();
});

test("opens Repositories from Home", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN); // down to Repositories (row 1; Setup is row 0)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write("\r"); // open Repositories
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("repos groundcrew is allowed to work on"),
  );
  unmount();
});

// Generous so the freshly-mounted TextField's useInput effect has subscribed to
// stdin before we start typing — the docs-prescribed pattern. 20ms is enough in
// isolation, but the full suite running 47 files concurrently can starve the
// timer, so we use a longer wait.
const SETTLE_AFTER_MOUNT_MS = 100;

test("an edit shows (edited) on the affected Home section", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  // Open Workspace (row 2: Setup, Repositories, Workspace).
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  await new Promise((resolve) => setTimeout(resolve, SETTLE_AFTER_MOUNT_MS));
  // Type a single char into projectDir (the focused field).
  stdin.write("x");
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("●"));
  // Esc back to Home; the section row gets (edited).
  stdin.write(ESC);
  await vi.waitFor(() => {
    const frame = lastFrame() ?? "";
    const line = frame.split("\n").find((l) => l.includes("Workspace")) ?? "";
    expect(line).toContain("(edited)");
  });
  unmount();
});

test("reverting a single field clears its marker", async () => {
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN); // -> Repositories
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write(DOWN); // -> Workspace
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  await new Promise((resolve) => setTimeout(resolve, SETTLE_AFTER_MOUNT_MS));
  stdin.write("x"); // edit projectDir
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("●"));
  stdin.write("\x7f"); // backspace -> revert
  await vi.waitFor(() => expect(lastFrame() ?? "").not.toContain("●"));
  unmount();
});

test("q on a dirty draft opens QuitGuard without tripping Rules-of-Hooks", async () => {
  // Regression: the modified-markers feature added a useMemo to App; if that
  // hook sits AFTER the `if (quitting)` early return, the very first render
  // skips it and the next render (after esc) re-adds it, tripping React's
  // "Rendered fewer hooks than expected" check. Reproduce by going dirty, then
  // pressing q (opens QuitGuard), then esc (returns home).
  const { lastFrame, stdin, unmount } = render(
    <App initialDraft={draft} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
  stdin.write("\r");
  await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
  await new Promise((resolve) => setTimeout(resolve, SETTLE_AFTER_MOUNT_MS));
  stdin.write("x"); // edit -> dirty
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("●"));
  stdin.write(ESC); // esc back to Home (still dirty)
  await vi.waitFor(() => {
    const frame = lastFrame() ?? "";
    const line = frame.split("\n").find((l) => l.includes("Workspace")) ?? "";
    expect(line).toContain("(edited)");
  });
  stdin.write("q"); // open QuitGuard
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Unsaved changes"));
  stdin.write(ESC); // cancel quit -> back to Home; hook count must match
  await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Workspace"));
  expect(lastFrame() ?? "").not.toContain("Unsaved changes");
  unmount();
});

test("loading a pre-4.42 plankeeper config surfaces the sandbox migration as an unsaved edit", () => {
  // groundcrew 4.42 introduced sandboxWritePaths; configs from older versions
  // have a plankeeper entry without it. App migrates the in-memory draft on
  // load but keeps baseline at the raw on-disk shape, so the user sees a `●`
  // they can save (or quit to leave the file alone).
  const stale = {
    workspace: { projectDir: "~/dev/groundcrew", knownRepositories: ["a/b"] },
    agents: { default: "claude", definitions: { claude: {} } },
    sources: [
      { kind: "shell", name: "plankeeper", commands: { fetch: "x" } },
    ],
  } as never;
  const { lastFrame, unmount } = render(
    <App initialDraft={stale} target={{ scope: "local", cwd: "/tmp" }} />,
  );
  const line =
    (lastFrame() ?? "")
      .split("\n")
      .find((l) => l.includes("Task Sources")) ?? "";
  expect(line).toContain("(edited)");
  unmount();
});

test("saving clears every modified marker — and the (edited) section badge", async () => {
  // saveDraft writes to disk; isolate in a per-test tmpdir so the test is
  // hermetic and doesn't pollute /tmp/crew.config.json across runs.
  const dir = mkdtempSync(path.join(tmpdir(), "cc-app-save-test-"));
  try {
    const { lastFrame, stdin, unmount } = render(
      <App initialDraft={draft} target={{ scope: "local", cwd: dir }} />,
    );
    // Make an edit so a `●` and an `(edited)` badge both appear, then esc home.
    stdin.write(DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
    stdin.write(DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
    await new Promise((resolve) => setTimeout(resolve, SETTLE_AFTER_MOUNT_MS));
    stdin.write("x");
    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("●"));
    stdin.write(ESC);
    await vi.waitFor(() => {
      const frame = lastFrame() ?? "";
      const line = frame.split("\n").find((l) => l.includes("Workspace")) ?? "";
      expect(line).toContain("(edited)");
    });
    // Save. After the async write resolves, baseline = draft, so every marker
    // (the row dot and the (edited) suffix) must clear.
    stdin.write("s");
    await vi.waitFor(() => expect(lastFrame() ?? "").not.toContain("(edited)"));
    expect(lastFrame() ?? "").not.toContain("●");
    unmount();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("offers crew doctor after a successful save and runs it on y", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-app-doctor-test-"));
  try {
    const crewDoctor = vi.fn(() =>
      Promise.resolve({ available: true, code: 0, output: "healthy" }),
    );
    const { stdin, lastFrame, unmount } = render(
      <App
        initialDraft={draft}
        target={{ scope: "local", cwd: dir }}
        crewDoctor={crewDoctor}
      />,
    );
    stdin.write("s");
    await vi.waitFor(() => expect(lastFrame()).toContain("✓ saved"));
    expect(lastFrame()).toContain("Run crew doctor?");
    stdin.write("y");
    await vi.waitFor(() => {
      expect(crewDoctor).toHaveBeenCalledOnce();
      expect(lastFrame()).toContain("healthy");
    });
    stdin.write("x"); // any key closes the view
    await vi.waitFor(() => expect(lastFrame()).toContain("crew-config"));
    unmount();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an edit after saving hides the doctor offer", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-app-doctor-edit-test-"));
  try {
    const crewDoctor = vi.fn(() =>
      Promise.resolve({ available: true, code: 0, output: "healthy" }),
    );
    const { stdin, lastFrame, unmount } = render(
      <App
        initialDraft={draft}
        target={{ scope: "local", cwd: dir }}
        crewDoctor={crewDoctor}
      />,
    );
    stdin.write("s");
    await vi.waitFor(() => expect(lastFrame()).toContain("Run crew doctor"));
    // Make an edit: open Workspace and type into its first field.
    stdin.write(DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ Repositories"));
    stdin.write(DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ Workspace"));
    stdin.write("\r");
    await vi.waitFor(() => expect(lastFrame()).toContain("worktreeDir"));
    await new Promise((resolve) => setTimeout(resolve, SETTLE_AFTER_MOUNT_MS));
    stdin.write("x");
    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("●"));
    stdin.write(ESC);
    await vi.waitFor(() => expect(lastFrame()).toContain("crew-config"));
    expect(lastFrame()).not.toContain("Run crew doctor");
    expect(crewDoctor).not.toHaveBeenCalled();
    unmount();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dismisses the doctor offer on esc without running anything", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-app-doctor-esc-test-"));
  try {
    const crewDoctor = vi.fn(() =>
      Promise.resolve({ available: true, code: 0, output: "healthy" }),
    );
    const { stdin, lastFrame, unmount } = render(
      <App
        initialDraft={draft}
        target={{ scope: "local", cwd: dir }}
        crewDoctor={crewDoctor}
      />,
    );
    stdin.write("s");
    await vi.waitFor(() => expect(lastFrame()).toContain("Run crew doctor"));
    stdin.write(ESC);
    await vi.waitFor(() => expect(lastFrame()).not.toContain("Run crew doctor"));
    expect(crewDoctor).not.toHaveBeenCalled();
    unmount();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
