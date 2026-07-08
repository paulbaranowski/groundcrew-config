import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { DiscoveredRepo } from "../domain/setup/repoDiscovery.ts";
import { RepoDiscoveryPicker } from "./RepoDiscoveryPicker.tsx";

const CANDIDATES: DiscoveredRepo[] = [
  { owner: "acme", repo: "api", name: "api", sources: ["gh"] },
  { owner: "acme", repo: "widgets", name: "widgets", sources: ["gh", "local"] },
  { owner: "zeta", repo: "tools", name: "tools", sources: ["local"] },
];

describe("RepoDiscoveryPicker", () => {
  it("lists candidates tagged by source, marking already-added ones", () => {
    const { lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={CANDIDATES}
        existingNames={new Set(["widgets"])}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(lastFrame()).toContain("acme/api");
    expect(lastFrame()).toContain("(gh, local)");
    expect(lastFrame()).toContain("already added");
  });

  it("space toggles selection and enter commits the chosen names", async () => {
    const onCommit = vi.fn();
    const { stdin, lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={CANDIDATES}
        existingNames={new Set()}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("acme/api"));
    stdin.write(" ");
    await vi.waitFor(() => expect(lastFrame()).toContain("[x] acme/api"));
    stdin.write("\x1b[B");
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] acme/widgets"));
    stdin.write(" ");
    await vi.waitFor(() => expect(lastFrame()).toContain("[x] acme/widgets"));
    stdin.write("\r");
    await vi.waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(["api", "widgets"]),
    );
  });

  it("space does nothing on an already-added row", async () => {
    const onCommit = vi.fn();
    const { stdin, lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={CANDIDATES}
        existingNames={new Set(["api"])}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("acme/api"));
    stdin.write(" ");
    stdin.write("\r");
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledWith([]));
  });

  it("esc cancels without committing", async () => {
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={CANDIDATES}
        existingNames={new Set()}
        onCommit={() => {}}
        onCancel={onCancel}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("acme/api"));
    stdin.write("\x1b");
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it("blocks selecting a second candidate with an already-selected folder name", async () => {
    const onCommit = vi.fn();
    // Two rows share the folder name "api" (acme/api, other/api); commit keys
    // on folder name, so only one may be selected.
    const collidingCandidates: DiscoveredRepo[] = [
      { owner: "acme", repo: "api", name: "api", sources: ["gh"] },
      { owner: "other", repo: "api", name: "api", sources: ["local"] },
    ];
    const { stdin, lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={collidingCandidates}
        existingNames={new Set()}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain("acme/api"));
    stdin.write(" "); // select acme/api
    await vi.waitFor(() => expect(lastFrame()).toContain("[x] acme/api"));
    stdin.write("\x1b[B"); // move to other/api
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] other/api"));
    stdin.write(" "); // blocked: same folder name is already selected
    await vi.waitFor(() => expect(lastFrame()).toContain("▸ [ ] other/api"));
    expect(lastFrame()).not.toContain("[x] other/api");
    stdin.write("\r");
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledWith(["api"]));
  });

  it("commits the folder name and shows it when it differs from the repo slug", async () => {
    const onCommit = vi.fn();
    // A clone of acme/widgets living in a folder named "my-widgets-fork".
    const renamed: DiscoveredRepo[] = [
      {
        owner: "acme",
        repo: "widgets",
        name: "my-widgets-fork",
        sources: ["local"],
      },
    ];
    const { stdin, lastFrame } = render(
      <RepoDiscoveryPicker
        candidates={renamed}
        existingNames={new Set()}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    // The row surfaces the on-disk folder name so the user sees what commits.
    await vi.waitFor(() =>
      expect(lastFrame()).toContain("acme/widgets → my-widgets-fork"),
    );
    stdin.write(" ");
    stdin.write("\r");
    await vi.waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(["my-widgets-fork"]),
    );
  });
});
