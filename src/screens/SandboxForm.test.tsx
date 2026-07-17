import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import type { ConfigDraft } from "../domain/types.ts";
import { SandboxForm } from "./SandboxForm.tsx";

const ESC = String.fromCharCode(27);
const DOWN = "\x1b[B";
const RIGHT = "\x1b[C";

function draftWith(local: ConfigDraft["local"]): ConfigDraft {
  return {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
    ...(local === undefined ? {} : { local }),
  } as ConfigDraft;
}

test("renders the two scalar rows and both list summary rows", () => {
  const draft = draftWith({
    runner: "safehouse",
    networkEgress: "allowlisted",
    readOnlyDirs: ["~/.rbenv", "~/.local/share/gem"],
    safehouse: { enable: ["agent-browser"] },
  });
  const { lastFrame } = render(
    <SandboxForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  expect(frame).toContain("Sandbox");
  expect(frame).toContain("runner");
  expect(frame).toContain("networkEgress");
  expect(frame).toContain("readOnlyDirs");
  expect(frame).toContain("2 dirs");
  expect(frame).toContain("safehouse.enable");
  expect(frame).toContain("1 profile");
});

test("defaults render when the draft has no local block", () => {
  const draft = draftWith(undefined);
  const { lastFrame } = render(
    <SandboxForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  // Runner row shows [auto] bracketed as the selected default.
  expect(frame).toContain("[auto]");
  // Egress default.
  expect(frame).toContain("[allowlisted]");
  // Both lists start at 0.
  expect(frame).toContain("0 dirs");
  expect(frame).toContain("0 profiles");
});

test("esc calls onBack", async () => {
  const onBack = vi.fn();
  const { stdin } = render(
    <SandboxForm
      draft={draftWith(undefined)}
      baseline={draftWith(undefined)}
      onChange={() => {}}
      onBack={onBack}
    />,
  );
  stdin.write(ESC);
  await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("→ on the runner row cycles to the next option", () => {
  const onChange = vi.fn();
  const { stdin } = render(
    <SandboxForm
      draft={draftWith({ runner: "auto" })}
      baseline={draftWith({ runner: "auto" })}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write(RIGHT);
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      local: expect.objectContaining({ runner: "safehouse" }),
    }),
  );
});

test("entering readOnlyDirs opens the string list editor for that field", async () => {
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draftWith({ readOnlyDirs: ["~/.rbenv"] })}
      baseline={draftWith({ readOnlyDirs: ["~/.rbenv"] })}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  // Down twice: runner → egress → readOnlyDirs.
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dirs"),
  );
  // The existing entry is listed.
  expect(lastFrame()).toContain("~/.rbenv");
});

test("adding a read-only dir writes local.readOnlyDirs", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draftWith(undefined)}
      baseline={draftWith(undefined)}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write("\r"); // open the list editor
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dirs"),
  );
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // open the entry editor
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dir"),
  );
  // Let the freshly-mounted TextField subscribe (same async caveat as ShellSandboxPathsEditor tests).
  await new Promise((r) => setTimeout(r, 20));
  // A path that's not in the entry-editor's placeholder text, else waitFor
  // returns on the placeholder match before the buffer has actually received
  // the keystrokes.
  const NEW_DIR = "/opt/toolchain";
  stdin.write(NEW_DIR);
  await vi.waitFor(() => expect(lastFrame()).toContain(NEW_DIR));
  stdin.write("\r"); // save
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        local: expect.objectContaining({ readOnlyDirs: [NEW_DIR] }),
      }),
    ),
  );
});

test("adding a safehouse profile writes local.safehouse.enable", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draftWith(undefined)}
      baseline={draftWith(undefined)}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  // Down thrice: runner → egress → readOnlyDirs → safehouse.enable.
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› safehouse.enable"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Safehouse extra profiles"),
  );
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // "+ add profile…"
  await vi.waitFor(() => expect(lastFrame()).toContain("Safehouse profile"));
  await new Promise((r) => setTimeout(r, 20));
  // Not in the placeholder text ("feature slug, e.g. agent-browser").
  const NEW_SLUG = "browser-native-messaging";
  stdin.write(NEW_SLUG);
  await vi.waitFor(() => expect(lastFrame()).toContain(NEW_SLUG));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        local: expect.objectContaining({
          safehouse: { enable: [NEW_SLUG] },
        }),
      }),
    ),
  );
});

test("d deletes the focused list entry", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draftWith({ readOnlyDirs: ["a", "b"] })}
      baseline={draftWith({ readOnlyDirs: ["a", "b"] })}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dirs"),
  );
  stdin.write("d"); // cursor starts on the first entry
  await vi.waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        local: expect.objectContaining({ readOnlyDirs: ["b"] }),
      }),
    ),
  );
});

test("unchanged list entries are not marked modified inside the list editor", async () => {
  // Regression: an earlier implementation shared a `seen` map between
  // baseline and current keyOf passes, so every unchanged non-empty row was
  // flagged modified (baseline key "a" vs current key "a__0").
  const draft = draftWith({ readOnlyDirs: ["~/.rbenv", "~/.local/share/gem"] });
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draft}
      baseline={draft}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dirs"),
  );
  const frame = lastFrame() ?? "";
  const rbenvLine = frame.split("\n").find((l) => l.includes("~/.rbenv")) ?? "";
  const gemLine =
    frame.split("\n").find((l) => l.includes("~/.local/share/gem")) ?? "";
  expect(rbenvLine).not.toContain("●");
  expect(gemLine).not.toContain("●");
});

test("changed lists render a ● marker on the summary row", () => {
  const baseline = draftWith({ readOnlyDirs: ["~/.rbenv"] });
  const draft = draftWith({ readOnlyDirs: ["~/.rbenv", "~/.local/share/gem"] });
  const { lastFrame } = render(
    <SandboxForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const frame = lastFrame() ?? "";
  const line = frame.split("\n").find((l) => l.includes("readOnlyDirs")) ?? "";
  expect(line).toContain("●");
});

test("a blank entry is refused (Enter on blank keeps editor open, no onChange)", async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin } = render(
    <SandboxForm
      draft={draftWith(undefined)}
      baseline={draftWith(undefined)}
      onChange={onChange}
      onBack={() => {}}
    />,
  );
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› networkEgress"));
  stdin.write(DOWN);
  await vi.waitFor(() => expect(lastFrame()).toContain("› readOnlyDirs"));
  stdin.write("\r");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dirs"),
  );
  stdin.write("\r"); // + add directory…
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Read-only sandbox dir"),
  );
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\r"); // Enter on blank
  expect(lastFrame()).toContain("value is required");
  expect(onChange).not.toHaveBeenCalled();
});
