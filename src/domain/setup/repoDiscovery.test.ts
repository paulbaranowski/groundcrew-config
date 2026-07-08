import { describe, expect, it } from "vitest";
import { extractOwnerRepo, mergeDiscovered } from "./repoDiscovery.ts";

function gitConfig(url: string): string {
  return `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[remote "upstream"]\n\turl = git@github.com:other/upstream.git\n`;
}

describe("extractOwnerRepo", () => {
  it("parses an ssh origin url", () => {
    expect(extractOwnerRepo(gitConfig("git@github.com:acme/widgets.git"))).toBe(
      "acme/widgets",
    );
  });

  it("parses an https origin url", () => {
    expect(
      extractOwnerRepo(gitConfig("https://github.com/acme/widgets.git")),
    ).toBe("acme/widgets");
  });

  it("parses urls without the .git suffix", () => {
    expect(extractOwnerRepo(gitConfig("https://github.com/acme/widgets"))).toBe(
      "acme/widgets",
    );
  });

  it("reads only the origin remote, not upstream", () => {
    const content = `[remote "upstream"]\n\turl = git@github.com:up/stream.git\n[remote "origin"]\n\turl = git@github.com:acme/widgets.git\n`;
    expect(extractOwnerRepo(content)).toBe("acme/widgets");
  });

  it("returns null for a non-GitHub origin", () => {
    expect(
      extractOwnerRepo(gitConfig("git@gitlab.com:acme/widgets.git")),
    ).toBeNull();
  });

  it("returns null when there is no origin remote", () => {
    expect(extractOwnerRepo("[core]\n\tbare = false\n")).toBeNull();
  });

  it("scans past a non-GitHub url to a later GitHub url in the same origin", () => {
    const content = `[remote "origin"]\n\turl = https://git.example.com/mirror/widgets.git\n\turl = git@github.com:acme/widgets.git\n`;
    expect(extractOwnerRepo(content)).toBe("acme/widgets");
  });
});

describe("mergeDiscovered", () => {
  it("merges gh and local hits into tagged entries sorted by owner/repo", () => {
    const merged = mergeDiscovered(
      ["acme/widgets", "acme/api"],
      [
        { ownerRepo: "acme/widgets", name: "widgets" },
        { ownerRepo: "zeta/tools", name: "tools" },
      ],
    );
    expect(merged).toEqual([
      { owner: "acme", repo: "api", name: "api", sources: ["gh"] },
      { owner: "acme", repo: "widgets", name: "widgets", sources: ["gh", "local"] },
      { owner: "zeta", repo: "tools", name: "tools", sources: ["local"] },
    ]);
  });

  it("commits the local folder name when it differs from the repo slug", () => {
    const merged = mergeDiscovered(
      ["acme/widgets"],
      [{ ownerRepo: "acme/widgets", name: "my-widgets-fork" }],
    );
    expect(merged).toEqual([
      {
        owner: "acme",
        repo: "widgets",
        name: "my-widgets-fork",
        sources: ["gh", "local"],
      },
    ]);
  });

  it("falls back to the repo slug for a gh-only hit not on disk", () => {
    expect(mergeDiscovered(["acme/api"], [])).toEqual([
      { owner: "acme", repo: "api", name: "api", sources: ["gh"] },
    ]);
  });

  it("drops malformed entries without a slash", () => {
    expect(mergeDiscovered(["not-owner-repo"], [])).toEqual([]);
  });

  it("dedupes repeated hits within one source", () => {
    const merged = mergeDiscovered([], [
      { ownerRepo: "acme/widgets", name: "widgets" },
      { ownerRepo: "acme/widgets", name: "widgets" },
    ]);
    expect(merged).toEqual([
      { owner: "acme", repo: "widgets", name: "widgets", sources: ["local"] },
    ]);
  });
});
