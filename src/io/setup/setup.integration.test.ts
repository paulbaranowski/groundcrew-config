import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { probeClearance, probeSafehouse } from "./probes.ts";
import type { InstallDeps } from "./installs.ts";
import {
  writeClearanceHosts,
  writeClearanceSidecar,
  writeSafehouseSidecar,
} from "./sidecars.ts";

// Full setup pass against a temp HOME: probe -> render everything -> re-probe.
// The machine-state deps are faked; only the filesystem is real.
describe("setup end-to-end (temp HOME)", () => {
  const noTools: InstallDeps = {
    run: () => Promise.resolve({ code: 1, stdout: "", stderr: "" }),
    which: () => null,
  };

  it("renders every artifact, flips the probes, and re-runs idempotently", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "setup-e2e-"));

    // Before: nothing is set up.
    const before = probeClearance(home, {});
    expect(before.personalFileExists).toBe(false);

    // Act: render the full artifact set.
    writeClearanceHosts(home, "append");
    writeClearanceSidecar(home);
    writeSafehouseSidecar(home);

    // After: the file-backed probe fields all flip (env vars flip only once
    // the user sources the sidecars, which crew-config never does itself, N3).
    const clearance = probeClearance(home, {});
    expect(clearance.personalFileExists).toBe(true);
    expect(clearance.personalFileHasClaudeHosts).toBe(true);
    const safehouse = await probeSafehouse(home, {}, noTools);
    expect(safehouse.sidecarPresent).toBe(true);
    expect(safehouse.sidecarHasFunctions).toBe(true);

    // The exact file set exists.
    const files = [
      ".config/clearance/personal-allow-hosts",
      ".config/clearance/env.sh",
      ".config/agent-safehouse/env.sh",
      ".config/agent-safehouse/local-overrides.sb",
    ].map((rel) => path.join(home, rel));
    const contents = files.map((f) => readFileSync(f, "utf8"));

    // Idempotent re-run (I2): identical bytes everywhere.
    writeClearanceHosts(home, "append");
    writeClearanceSidecar(home);
    writeSafehouseSidecar(home);
    files.forEach((f, i) => {
      expect(readFileSync(f, "utf8")).toBe(contents[i]);
    });
  });

  it("respects rc-owned definitions across the whole pass (F5, I3)", async () => {
    const home = mkdtempSync(path.join(tmpdir(), "setup-e2e-rc-"));
    const zshrc = path.join(home, ".zshrc");
    mkdirSync(path.dirname(zshrc), { recursive: true });
    const rcContent = [
      "export CLEARANCE_PERSONAL_HOSTS=1",
      "safe-claude() { safe claude; }",
      "",
    ].join("\n");
    writeFileSync(zshrc, rcContent);

    const clearanceResult = writeClearanceSidecar(home);
    const safehouseResult = writeSafehouseSidecar(home);

    expect(clearanceResult.rcConflicts.map((m) => m.item)).toEqual([
      "CLEARANCE_PERSONAL_HOSTS",
    ]);
    expect(safehouseResult.rcConflicts.map((m) => m.item)).toEqual([
      "safe-claude",
    ]);
    // The rc file is byte-identical: read, never written (I3).
    expect(readFileSync(zshrc, "utf8")).toBe(rcContent);
    // When a wrapper function is rc-owned, the sidecar's copy is commented
    // out, so sidecarHasFunctions is legitimately false while the overall
    // setup is still functional (the rc provides the function).
    const safehouse = await probeSafehouse(home, {}, noTools);
    expect(safehouse.sidecarHasFunctions).toBe(false);
  });
});
