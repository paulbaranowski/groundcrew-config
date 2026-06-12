import { useState } from "react";
import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { RepositoriesForm } from "./RepositoriesForm.tsx";
import type { ConfigDraft } from "../domain/types.ts";

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
      onChange={setCurrent}
      onBack={() => {}}
    />
  );
}

test("renders the repo list and flags the duplicate", () => {
  const { lastFrame } = render(
    <RepositoriesForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Repositories");
  expect(lastFrame()).toContain("a/b");
  expect(lastFrame()).toContain("duplicate");
  expect(lastFrame()).toContain("+ add");
});

test("help line lists the duplicate shortcut", () => {
  const { lastFrame } = render(
    <RepositoriesForm draft={draft} onChange={() => {}} onBack={() => {}} />,
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
