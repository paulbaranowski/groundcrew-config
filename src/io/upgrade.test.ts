import { describe, expect, test } from "vitest";
import {
  commandFor,
  detectChannel,
  runUpgrade,
  type UpgradeDeps,
} from "./upgrade.ts";

describe("detectChannel", () => {
  test("script under the brew formula keg -> brew", () => {
    expect(
      detectChannel({
        scriptRealpath:
          "/opt/homebrew/Cellar/crew-config/1.0.21/libexec/dist/cli.js",
        brewFormulaPrefix: "/opt/homebrew/Cellar/crew-config/1.0.21",
        npmGlobalPrefix: "/usr/local",
      }),
    ).toBe("brew");
  });

  test("script under the npm global prefix -> installer", () => {
    expect(
      detectChannel({
        scriptRealpath:
          "/usr/local/lib/node_modules/@clipboard-health/groundcrew-config/dist/cli.js",
        brewFormulaPrefix: "",
        npmGlobalPrefix: "/usr/local",
      }),
    ).toBe("installer");
  });

  test("script under neither prefix -> unknown (source checkout)", () => {
    expect(
      detectChannel({
        scriptRealpath: "/Users/me/dev/groundcrew-config/src/cli.tsx",
        brewFormulaPrefix: "/opt/homebrew/Cellar/crew-config/1.0.21",
        npmGlobalPrefix: "/usr/local",
      }),
    ).toBe("unknown");
  });

  // Homebrew's own node installs global packages inside /opt/homebrew, so the
  // npm prefix can nest within the overall brew tree. Detection keys off the
  // formula-specific keg (which can never contain an npm-global package), so a
  // curl-installed binary is still correctly read as the installer channel.
  test("brew-node overlap: npm prefix nested in brew tree, script under npm -> installer", () => {
    expect(
      detectChannel({
        scriptRealpath:
          "/opt/homebrew/lib/node_modules/@clipboard-health/groundcrew-config/dist/cli.js",
        brewFormulaPrefix: "/opt/homebrew/Cellar/crew-config/1.0.21",
        npmGlobalPrefix: "/opt/homebrew",
      }),
    ).toBe("installer");
  });

  test("a sibling dir sharing a prefix string is not 'contained' (segment-aware)", () => {
    expect(
      detectChannel({
        scriptRealpath: "/usr/local-other/cli.js",
        brewFormulaPrefix: "",
        npmGlobalPrefix: "/usr/local",
      }),
    ).toBe("unknown");
  });

  test("an empty prefix never matches", () => {
    expect(
      detectChannel({
        scriptRealpath: "/anything/cli.js",
        brewFormulaPrefix: "",
        npmGlobalPrefix: "",
      }),
    ).toBe("unknown");
  });
});

describe("commandFor", () => {
  test("brew -> fully-qualified tap upgrade", () => {
    expect(commandFor("brew")).toEqual({
      echo: "brew upgrade paulbaranowski/tap/crew-config",
      cmd: "brew",
      args: ["upgrade", "paulbaranowski/tap/crew-config"],
    });
  });

  test("installer -> curl|bash run through bash -c", () => {
    const c = commandFor("installer");
    expect(c?.cmd).toBe("bash");
    expect(c?.args[0]).toBe("-c");
    expect(c?.args[1]).toContain("curl -fsSL");
    expect(c?.args[1]).toContain("install.sh");
    expect(c?.args[1]).toContain("| bash");
    // The echoed line is exactly the pipeline we run.
    expect(c?.echo).toBe(c?.args[1]);
  });

  test("unknown -> null", () => {
    expect(commandFor("unknown")).toBeNull();
  });
});

describe("runUpgrade", () => {
  test("brew channel: echoes and spawns brew upgrade, returns child code", () => {
    const logs: string[] = [];
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const code = runUpgrade({
      scriptPath: "/opt/homebrew/Cellar/crew-config/1/libexec/dist/cli.js",
      realpath: (p) => p,
      brewFormulaPrefix: () => "/opt/homebrew/Cellar/crew-config/1",
      npmGlobalPrefix: () => "",
      run: (cmd, args) => {
        calls.push({ cmd, args });
        return 0;
      },
      log: (m) => logs.push(m),
    });
    expect(code).toBe(0);
    expect(calls).toEqual([
      { cmd: "brew", args: ["upgrade", "paulbaranowski/tap/crew-config"] },
    ]);
    expect(logs.join("\n")).toContain(
      "brew upgrade paulbaranowski/tap/crew-config",
    );
  });

  test("installer channel: spawns bash -c curl|bash, propagates non-zero code", () => {
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const code = runUpgrade({
      scriptPath: "/usr/local/lib/node_modules/x/dist/cli.js",
      realpath: (p) => p,
      brewFormulaPrefix: () => "",
      npmGlobalPrefix: () => "/usr/local",
      run: (cmd, args) => {
        calls.push({ cmd, args });
        return 7;
      },
      log: () => {},
    });
    expect(code).toBe(7);
    expect(calls[0]?.cmd).toBe("bash");
    expect(calls[0]?.args[1]).toContain("curl -fsSL");
  });

  test("unknown channel: runs nothing, prints both commands, returns 1", () => {
    const logs: string[] = [];
    const calls: unknown[] = [];
    const code = runUpgrade({
      scriptPath: "/Users/me/dev/groundcrew-config/src/cli.tsx",
      realpath: (p) => p,
      brewFormulaPrefix: () => "",
      npmGlobalPrefix: () => "",
      run: (...a: unknown[]) => {
        calls.push(a);
        return 0;
      },
      log: (m) => logs.push(m),
    });
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
    const out = logs.join("\n");
    expect(out).toContain("brew upgrade paulbaranowski/tap/crew-config");
    expect(out).toContain("install.sh");
  });

  test("a non-existent script path realpath failure -> unknown guidance", () => {
    // The default realpath throws on a missing path; runUpgrade must treat that
    // as 'no resolvable location' rather than crashing.
    const throwingRealpath: UpgradeDeps["realpath"] = () => {
      throw new Error("ENOENT");
    };
    const code = runUpgrade({
      scriptPath: "/does/not/exist",
      realpath: throwingRealpath,
      brewFormulaPrefix: () => "/opt/homebrew/Cellar/crew-config/1",
      npmGlobalPrefix: () => "/usr/local",
      run: () => 0,
      log: () => {},
    });
    expect(code).toBe(1);
  });
});
