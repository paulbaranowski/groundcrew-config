import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOSTS_DEFAULT_BODY } from "../../domain/setup/clearance.ts";
import {
  writeAtomic,
  writeClearanceHosts,
  writeClearanceSidecar,
  writeSafehouseSidecar,
} from "./sidecars.ts";

function tempHome(): string {
  return mkdtempSync(path.join(tmpdir(), "sidecars-home-"));
}

function writeHomeFile(home: string, relative: string, content: string): void {
  const target = path.join(home, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

describe("writeAtomic", () => {
  it("creates parent directories and writes the content", () => {
    const home = tempHome();
    const target = path.join(home, "a/b/c.txt");
    writeAtomic(target, "hello\n");
    expect(readFileSync(target, "utf8")).toBe("hello\n");
  });

  it("replaces an existing file and leaves no temp litter", () => {
    const home = tempHome();
    const target = path.join(home, "f.txt");
    writeAtomic(target, "one\n");
    writeAtomic(target, "two\n");
    expect(readFileSync(target, "utf8")).toBe("two\n");
    const leftovers = readdirSync(path.dirname(target)).filter((f) =>
      f.endsWith(".tmp"),
    );
    expect(leftovers).toEqual([]);
  });
});

describe("writeClearanceHosts", () => {
  const REL = ".config/clearance/personal-allow-hosts";

  it("create mode writes the default body when the file is absent", () => {
    const home = tempHome();
    const result = writeClearanceHosts(home, "create");
    expect(result).toEqual({
      target: path.join(home, REL),
      wrote: true,
      refused: false,
    });
    expect(readFileSync(result.target, "utf8")).toBe(HOSTS_DEFAULT_BODY);
  });

  it("create mode refuses to overwrite an existing file (protects hand edits)", () => {
    const home = tempHome();
    writeHomeFile(home, REL, "my.custom.host\n");
    const result = writeClearanceHosts(home, "create");
    expect(result.refused).toBe(true);
    expect(result.wrote).toBe(false);
    expect(readFileSync(result.target, "utf8")).toBe("my.custom.host\n");
  });

  it("append mode creates with the default body when absent", () => {
    const home = tempHome();
    const result = writeClearanceHosts(home, "append");
    expect(result.wrote).toBe(true);
    expect(readFileSync(result.target, "utf8")).toBe(HOSTS_DEFAULT_BODY);
  });

  it("append mode adds only missing hosts and preserves user content", () => {
    const home = tempHome();
    writeHomeFile(home, REL, "my.custom.host\ndownloads.claude.ai\n");
    const result = writeClearanceHosts(home, "append");
    expect(result.wrote).toBe(true);
    const content = readFileSync(result.target, "utf8");
    expect(content).toContain("my.custom.host");
    expect(content).toContain("mcp-proxy.anthropic.com");
    // Idempotent (I2): a second append is a no-op with identical content.
    const again = writeClearanceHosts(home, "append");
    expect(again.wrote).toBe(false);
    expect(readFileSync(result.target, "utf8")).toBe(content);
  });
});

describe("writeClearanceSidecar", () => {
  it("writes the sidecar and reports no conflicts on a clean home", () => {
    const home = tempHome();
    const result = writeClearanceSidecar(home);
    expect(result.target).toBe(path.join(home, ".config/clearance/env.sh"));
    expect(result.rcConflicts).toEqual([]);
    const content = readFileSync(result.target, "utf8");
    expect(content).toContain("export CLEARANCE_PERSONAL_HOSTS=1");
  });

  it("re-derives rc conflicts fresh on regeneration (I2)", () => {
    const home = tempHome();
    writeClearanceSidecar(home);
    // The user later moves the export into their zshrc...
    writeHomeFile(home, ".zshrc", "export CLEARANCE_ALLOW_HOSTS_FILES=/mine\n");
    const result = writeClearanceSidecar(home);
    expect(result.rcConflicts.map((m) => m.item)).toEqual([
      "CLEARANCE_ALLOW_HOSTS_FILES",
    ]);
    const content = readFileSync(result.target, "utf8");
    expect(content).toContain("# export CLEARANCE_ALLOW_HOSTS_FILES=");
    // The rc file itself was never written (I3).
    expect(readFileSync(path.join(home, ".zshrc"), "utf8")).toBe(
      "export CLEARANCE_ALLOW_HOSTS_FILES=/mine\n",
    );
  });
});

describe("writeSafehouseSidecar", () => {
  it("writes the sidecar and the overrides stub on first run", () => {
    const home = tempHome();
    const result = writeSafehouseSidecar(home);
    expect(result.target).toBe(
      path.join(home, ".config/agent-safehouse/env.sh"),
    );
    expect(result.overridesStub).toBe(
      path.join(home, ".config/agent-safehouse/local-overrides.sb"),
    );
    const sidecar = readFileSync(result.target, "utf8");
    expect(sidecar).toContain("safe() {");
    expect(sidecar).toContain(
      `export SAFEHOUSE_APPEND_PROFILE="${result.overridesStub}"`,
    );
  });

  it("never regenerates an existing overrides stub (user-owned once created)", () => {
    const home = tempHome();
    writeHomeFile(
      home,
      ".config/agent-safehouse/local-overrides.sb",
      ";; my custom rules\n",
    );
    const result = writeSafehouseSidecar(home);
    expect(result.overridesStub).toBeNull();
    expect(
      readFileSync(
        path.join(home, ".config/agent-safehouse/local-overrides.sb"),
        "utf8",
      ),
    ).toBe(";; my custom rules\n");
  });

  it("comments out rc-owned items with a note (F5)", () => {
    const home = tempHome();
    writeHomeFile(home, ".zshrc", 'safe() {\n  safehouse "$@"\n}\n');
    const result = writeSafehouseSidecar(home);
    expect(result.rcConflicts.map((m) => m.item)).toEqual(["safe"]);
    const sidecar = readFileSync(result.target, "utf8");
    expect(sidecar).toContain("Already defined in");
    expect(sidecar).toContain("# safe() {");
  });
});
