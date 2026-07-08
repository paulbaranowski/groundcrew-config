import { useState } from "react";
import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { RepositoriesForm } from "./RepositoriesForm.tsx";
import type { ConfigDraft } from "../domain/types.ts";
import type { DiscoveredRepo } from "../domain/setup/repoDiscovery.ts";

const draft = {
  workspace: {
    projectDir: "~/dev/groundcrew",
    knownRepositories: ["a/b", "a/b"],
  },
} as never;

// A stateful host that threads `onChange` back as the next `draft`, mirroring
// how `App` owns the draft — so commits made by the screen are visible on the
// next render (a no-op `onChange` would hide them).
function Host({ initial }: { initial: ConfigDraft }) {
  const [current, setCurrent] = useState(initial);
  return (
    <RepositoriesForm
      draft={current}
      baseline={initial}
      onChange={setCurrent}
      onBack={() => {}}
    />
  );
}

test("renders the repo list and flags the duplicate", () => {
  const { lastFrame } = render(
    <RepositoriesForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Repositories");
  expect(lastFrame()).toContain("a/b");
  expect(lastFrame()).toContain("duplicate");
  expect(lastFrame()).toContain("+ add");
});

test("help line lists the duplicate shortcut", () => {
  const { lastFrame } = render(
    <RepositoriesForm draft={draft} baseline={draft} onChange={() => {}} onBack={() => {}} />,
  );
  // The help line wraps in the test's terminal width, so assert on the
  // contiguous portion carrying the new confirm-on-delete copy.
  expect(lastFrame()).toContain("c duplicate · d delete (confirm)");
});

test("c on a scripted repo opens the sub-form prefilled with the copy", async () => {
  const scripted = {
    workspace: {
      projectDir: "~/dev/groundcrew",
      knownRepositories: [
        {
          name: "maple",
          provision: { create: "graft add maple", remove: "graft rm maple" },
        },
      ],
    },
  } as never as ConfigDraft;

  const { stdin, lastFrame } = render(<Host initial={scripted} />);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ maple"));

  stdin.write("c");
  // The sub-form opens prefilled: unique copy name + the duplicated provision.
  await vi.waitFor(() => expect(lastFrame()).toContain("Repository"));
  expect(lastFrame()).toContain("maple-copy");
  expect(lastFrame()).toContain("graft add maple");
  expect(lastFrame()).toContain("graft rm maple");
});

test("d shows the delete confirmation and does not delete until confirmed", async () => {
  const two = {
    workspace: {
      projectDir: "~/dev/groundcrew",
      knownRepositories: ["maple", "oak"],
    },
  } as never as ConfigDraft;

  const { stdin, lastFrame } = render(<Host initial={two} />);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ maple"));

  stdin.write("d"); // request delete of the focused repo
  // The guard appears; the repo is still in the (now-hidden) list behind it.
  await vi.waitFor(() => expect(lastFrame()).toContain("Delete maple?"));
  expect(lastFrame()).toContain("[esc] Cancel");
});

test("y on the delete guard removes the focused repo", async () => {
  const two = {
    workspace: {
      projectDir: "~/dev/groundcrew",
      knownRepositories: ["maple", "oak"],
    },
  } as never as ConfigDraft;

  const { stdin, lastFrame } = render(<Host initial={two} />);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ maple"));

  stdin.write("d");
  await vi.waitFor(() => expect(lastFrame()).toContain("Delete maple?"));

  stdin.write("y"); // confirm
  await vi.waitFor(() => expect(lastFrame()).toContain("Repositories"));
  expect(lastFrame()).not.toContain("maple");
  expect(lastFrame()).toContain("oak");
});

test("esc on the delete guard keeps the repo", async () => {
  const two = {
    workspace: {
      projectDir: "~/dev/groundcrew",
      knownRepositories: ["maple", "oak"],
    },
  } as never as ConfigDraft;

  const { stdin, lastFrame } = render(<Host initial={two} />);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ maple"));

  stdin.write("d");
  await vi.waitFor(() => expect(lastFrame()).toContain("Delete maple?"));

  stdin.write("\x1b"); // cancel
  await vi.waitFor(() => expect(lastFrame()).not.toContain("Delete maple?"));
  // Both repos survive a cancelled delete.
  expect(lastFrame()).toContain("maple");
  expect(lastFrame()).toContain("oak");
});

test("c commits the copy immediately; esc returns to a list holding both repos", async () => {
  const one = {
    workspace: {
      projectDir: "~/dev/groundcrew",
      knownRepositories: ["maple"],
    },
  } as never as ConfigDraft;

  const { stdin, lastFrame } = render(<Host initial={one} />);
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ maple"));

  stdin.write("c"); // duplicate — commits and opens the prefilled sub-form
  await vi.waitFor(() => expect(lastFrame()).toContain("Repository"));

  stdin.write("\x1b"); // esc out without editing
  // Duplicating is an immediate action (per the ticket): the copy stays in the
  // list. Esc declines to rename it, it does not undo the duplicate.
  await vi.waitFor(() => expect(lastFrame()).toContain("Repositories"));
  expect(lastFrame()).toContain("maple");
  expect(lastFrame()).toContain("maple-copy");
});

test("f runs discovery and merges picked repos without duplicates", async () => {
  const discover = vi.fn(() =>
    Promise.resolve([
      { owner: "acme", repo: "widgets", sources: ["gh" as const] },
      { owner: "acme", repo: "existing-repo", sources: ["local" as const] },
    ]),
  );
  const onChange = vi.fn();
  // Draft fixture: knownRepositories already holds "existing-repo" (as the
  // object form with a projectDirOverride, to prove settings are preserved).
  const draft = {
    workspace: {
      projectDir: "~/dev",
      knownRepositories: [
        { name: "existing-repo", projectDirOverride: "/elsewhere" },
      ],
    },
  } as never as ConfigDraft;
  const { stdin, lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
      discover={discover}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("existing-repo"));
  stdin.write("f");
  await vi.waitFor(() => {
    expect(discover).toHaveBeenCalledWith("~/dev");
    expect(lastFrame()).toContain("Discovered repositories");
  });
  // Select acme/widgets (first row) and commit.
  stdin.write(" ");
  await vi.waitFor(() => expect(lastFrame()).toContain("[x] acme/widgets"));
  stdin.write("\r");
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  const next = onChange.mock.calls[0]![0];
  expect(next.workspace.knownRepositories).toEqual([
    { name: "existing-repo", projectDirOverride: "/elsewhere" },
    "widgets",
  ]);
});

test("picking two owners of the same folder name commits a single entry", async () => {
  const discover = vi.fn(() =>
    Promise.resolve([
      { owner: "acme", repo: "widgets", sources: ["gh" as const] },
      { owner: "fork", repo: "widgets", sources: ["local" as const] },
    ]),
  );
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never as ConfigDraft;
  const { stdin, lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
      discover={discover}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  stdin.write("f");
  await vi.waitFor(() =>
    expect(lastFrame()).toContain("Discovered repositories"),
  );
  stdin.write(" "); // select acme/widgets
  await vi.waitFor(() => expect(lastFrame()).toContain("[x] acme/widgets"));
  stdin.write("\x1b[B"); // down to fork/widgets (same folder name)
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] fork/widgets"));
  stdin.write(" "); // the picker blocks selecting a colliding folder name
  // Give the (no-op) keystroke a tick; fork/widgets must stay unchecked.
  await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] fork/widgets"));
  expect(lastFrame()).not.toContain("[x] fork/widgets");
  stdin.write("\r"); // commit
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  // Only the first owner's row was selectable, so one "widgets" entry lands.
  expect(onChange.mock.calls[0]![0].workspace.knownRepositories).toEqual([
    "widgets",
  ]);
});

test("esc from the picker returns to the list without changes", async () => {
  const discover = vi.fn(() =>
    Promise.resolve([{ owner: "a", repo: "r", sources: ["gh" as const] }]),
  );
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never as ConfigDraft;
  const { stdin, lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
      discover={discover}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  stdin.write("f");
  await vi.waitFor(() => expect(lastFrame()).toContain("Discovered"));
  stdin.write("\x1b");
  await vi.waitFor(() => expect(lastFrame()).toContain("Repositories"));
  expect(onChange).not.toHaveBeenCalled();
});

test("esc during discovery loading returns to the list and ignores a late result", async () => {
  let resolveDiscovery!: (repos: DiscoveredRepo[]) => void;
  const discover = vi.fn(
    () =>
      new Promise<DiscoveredRepo[]>((resolve) => {
        resolveDiscovery = resolve;
      }),
  );
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never as ConfigDraft;
  const { stdin, lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={() => {}}
      discover={discover}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  stdin.write("f");
  await vi.waitFor(() => expect(lastFrame()).toContain("discovering repos"));
  stdin.write("\x1b"); // cancel the in-flight scan
  await vi.waitFor(() => expect(lastFrame()).not.toContain("discovering repos"));
  // A scan that resolves after the user backed out must not pop the picker.
  resolveDiscovery([{ owner: "a", repo: "r", sources: ["gh"] }]);
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  expect(lastFrame()).not.toContain("Discovered repositories");
  expect(onChange).not.toHaveBeenCalled();
});

test("f then esc in a single input tick cancels rather than navigating away", async () => {
  let resolveDiscovery!: (repos: DiscoveredRepo[]) => void;
  const discover = vi.fn(
    () =>
      new Promise<DiscoveredRepo[]>((resolve) => {
        resolveDiscovery = resolve;
      }),
  );
  const onBack = vi.fn();
  const onChange = vi.fn();
  const draft = {
    workspace: { projectDir: "~/dev", knownRepositories: [] },
  } as never as ConfigDraft;
  const { stdin, lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={draft}
      onChange={onChange}
      onBack={onBack}
      discover={discover}
    />,
  );
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  // Both keystrokes land in one chunk, before a re-render: the handler sees the
  // same stale `discovery` closure for both, so the phase ref is what lets esc
  // resolve to "cancel the scan just started" instead of "back out of screen".
  stdin.write("f\x1b");
  await vi.waitFor(() => expect(discover).toHaveBeenCalledOnce());
  expect(onBack).not.toHaveBeenCalled();
  // The late scan result must not pop the picker onto an idle/abandoned screen.
  resolveDiscovery([{ owner: "a", repo: "r", sources: ["gh"] }]);
  await vi.waitFor(() => expect(lastFrame()).toContain("+ add repository"));
  expect(lastFrame()).not.toContain("Discovered repositories");
});

test("marks a changed repo entry with ●", () => {
  const baseline = {
    workspace: { projectDir: "~/dev", knownRepositories: ["a", "b"] },
  } as never;
  const draft = {
    workspace: {
      projectDir: "~/dev",
      knownRepositories: ["a", { name: "b", projectDirOverride: "/elsewhere" }],
    },
  } as never;
  const { lastFrame } = render(
    <RepositoriesForm
      draft={draft}
      baseline={baseline}
      onChange={() => {}}
      onBack={() => {}}
    />,
  );
  const lineB =
    (lastFrame() ?? "").split("\n").find((l) => l.includes(" b")) ?? "";
  expect(lineB).toContain("●");
  const lineA =
    (lastFrame() ?? "").split("\n").find((l) => l.match(/(^|\s)a(\s|$)/)) ?? "";
  expect(lineA).not.toContain("●");
});
