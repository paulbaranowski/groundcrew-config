import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverRepos, findGitConfigs, ghRepoList } from "./discoverRepos.ts";

function makeRepo(root: string, relative: string, originUrl: string): void {
  const gitDir = path.join(root, relative, ".git");
  mkdirSync(gitDir, { recursive: true });
  writeFileSync(
    path.join(gitDir, "config"),
    `[remote "origin"]\n\turl = ${originUrl}\n`,
  );
}

describe("findGitConfigs", () => {
  it("finds repos at depth 1 through 3 but not 4", () => {
    const root = mkdtempSync(path.join(tmpdir(), "scan-"));
    makeRepo(root, "r1", "git@github.com:a/r1.git");
    makeRepo(root, "g/r2", "git@github.com:a/r2.git");
    makeRepo(root, "g/h/r3", "git@github.com:a/r3.git");
    makeRepo(root, "g/h/i/r4", "git@github.com:a/r4.git");
    const found = findGitConfigs(root).map((p) => path.relative(root, p));
    expect(found.sort()).toEqual([
      "g/h/r3/.git/config",
      "g/r2/.git/config",
      "r1/.git/config",
    ]);
  });

  it("prunes dependency/build directories", () => {
    const root = mkdtempSync(path.join(tmpdir(), "scan-"));
    makeRepo(root, "node_modules/dep", "git@github.com:a/dep.git");
    makeRepo(root, "app/vendor/lib", "git@github.com:a/lib.git");
    makeRepo(root, "app", "git@github.com:a/app.git");
    const found = findGitConfigs(root).map((p) => path.relative(root, p));
    expect(found).toEqual(["app/.git/config"]);
  });

  it("returns empty for a missing scan dir", () => {
    expect(findGitConfigs("/definitely/not/a/dir")).toEqual([]);
  });
});

describe("ghRepoList", () => {
  it("returns nameWithOwner strings from gh json output", async () => {
    const repos = await ghRepoList({
      run: () =>
        Promise.resolve({
          code: 0,
          stdout: JSON.stringify([
            { nameWithOwner: "acme/widgets" },
            { nameWithOwner: "acme/api" },
          ]),
          stderr: "",
        }),
      which: () => "/usr/local/bin/gh",
    });
    expect(repos).toEqual(["acme/widgets", "acme/api"]);
  });

  it.each([
    ["gh missing", { code: 0, stdout: "[]", stderr: "" }, false],
    ["non-zero exit", { code: 1, stdout: "", stderr: "auth required" }, true],
    ["bad json", { code: 0, stdout: "not json", stderr: "" }, true],
    ["non-array json", { code: 0, stdout: "{}", stderr: "" }, true],
  ] as const)("returns [] silently on %s", async (_name, result, hasGh) => {
    const repos = await ghRepoList({
      run: () => Promise.resolve({ ...result }),
      which: () => (hasGh ? "/usr/local/bin/gh" : null),
    });
    expect(repos).toEqual([]);
  });
});

describe("discoverRepos", () => {
  it("merges gh and local scans across default roots and the workspace dir", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "disc-home-"));
    makeRepo(
      path.join(home, "dev"),
      "widgets",
      "git@github.com:acme/widgets.git",
    );
    const workspace = mkdtempSync(path.join(tmpdir(), "disc-ws-"));
    makeRepo(workspace, "tools", "https://github.com/zeta/tools.git");
    const repos = await discoverRepos(home, workspace, {
      run: () =>
        Promise.resolve({
          code: 0,
          stdout: JSON.stringify([{ nameWithOwner: "acme/widgets" }]),
          stderr: "",
        }),
      which: () => "/usr/local/bin/gh",
    });
    expect(repos).toEqual([
      { owner: "acme", repo: "widgets", sources: ["gh", "local"] },
      { owner: "zeta", repo: "tools", sources: ["local"] },
    ]);
  });

  it("expands ~ in the workspace dir against home", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "disc-home-"));
    makeRepo(path.join(home, "stuff"), "app", "git@github.com:a/app.git");
    const repos = await discoverRepos(home, "~/stuff", {
      run: () => Promise.resolve({ code: 1, stdout: "", stderr: "" }),
      which: () => null,
    });
    expect(repos).toEqual([{ owner: "a", repo: "app", sources: ["local"] }]);
  });
});
