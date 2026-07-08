import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { DiscoveredRepo } from "../domain/setup/repoDiscovery.ts";
import { RepoDiscoveryPicker } from "./RepoDiscoveryPicker.tsx";

const CANDIDATES: DiscoveredRepo[] = [
  { owner: "acme", repo: "api", sources: ["gh"] },
  { owner: "acme", repo: "widgets", sources: ["gh", "local"] },
  { owner: "zeta", repo: "tools", sources: ["local"] },
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
});
