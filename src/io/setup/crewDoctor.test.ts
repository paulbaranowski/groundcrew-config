import { describe, expect, it } from "vitest";
import { runCrewDoctor } from "./crewDoctor.ts";

describe("runCrewDoctor", () => {
  it("reports unavailable with guidance when crew is not on PATH", async () => {
    const result = await runCrewDoctor({
      run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
      which: () => null,
    });
    expect(result.available).toBe(false);
    expect(result.output).toContain("crew not found");
  });

  it("captures combined output and the exit status (F7)", async () => {
    const result = await runCrewDoctor({
      run: () =>
        Promise.resolve({
          code: 3,
          stdout: "checking...\n",
          stderr: "bad: x\n",
        }),
      which: () => "/usr/local/bin/crew",
    });
    expect(result.available).toBe(true);
    expect(result.code).toBe(3);
    expect(result.output).toContain("checking...");
    expect(result.output).toContain("bad: x");
  });

  it("surfaces a spawn failure as output", async () => {
    const result = await runCrewDoctor({
      run: () =>
        Promise.resolve({
          code: -1,
          stdout: "",
          stderr: "",
          error: "timed out after 120000ms",
        }),
      which: () => "/usr/local/bin/crew",
    });
    expect(result.output).toContain("timed out");
  });
});
