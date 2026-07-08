import { describe, expect, it } from "vitest";
import {
  extractExportValue,
  scanRcContents,
  type RcTarget,
} from "./rcScan.ts";

const EXPORT_TARGET: RcTarget = {
  kind: "export",
  name: "CLEARANCE_ALLOW_HOSTS_FILES",
};
const SAFE_FN: RcTarget = { kind: "function", name: "safe" };
const SAFE_CLAUDE_FN: RcTarget = { kind: "function", name: "safe-claude" };

describe("scanRcContents", () => {
  it("finds an uncommented export with its file and 1-based line", () => {
    const files = [
      {
        file: "/home/u/.zshrc",
        content:
          "alias ll='ls -l'\nexport CLEARANCE_ALLOW_HOSTS_FILES=/tmp/x\n",
      },
    ];
    const found = scanRcContents(files, [EXPORT_TARGET]);
    expect(found.get("CLEARANCE_ALLOW_HOSTS_FILES")).toEqual({
      item: "CLEARANCE_ALLOW_HOSTS_FILES",
      file: "/home/u/.zshrc",
      line: 2,
      value: "/tmp/x",
    });
  });

  it("ignores commented-out exports", () => {
    const files = [
      {
        file: "/home/u/.zshrc",
        content: "# export CLEARANCE_ALLOW_HOSTS_FILES=/tmp/x\n",
      },
    ];
    expect(scanRcContents(files, [EXPORT_TARGET]).size).toBe(0);
  });

  it("ignores lines that merely mention the var name (no substring matches)", () => {
    const files = [
      {
        file: "/home/u/.zshrc",
        content: [
          'echo "remember to set CLEARANCE_ALLOW_HOSTS_FILES"',
          "unset CLEARANCE_ALLOW_HOSTS_FILES",
          'export OTHER="${CLEARANCE_ALLOW_HOSTS_FILES:+x}"',
          // Prefix-extended name must not match either.
          "export CLEARANCE_ALLOW_HOSTS_FILES_BACKUP=1",
        ].join("\n"),
      },
    ];
    expect(scanRcContents(files, [EXPORT_TARGET]).size).toBe(0);
  });

  it("matches a bare `export VAR` declaration without a value", () => {
    const files = [
      {
        file: "/home/u/.profile",
        content: "export CLEARANCE_ALLOW_HOSTS_FILES\n",
      },
    ];
    const match = scanRcContents(files, [EXPORT_TARGET]).get(
      "CLEARANCE_ALLOW_HOSTS_FILES",
    );
    expect(match?.line).toBe(1);
    expect(match?.value).toBeNull();
  });

  it("finds function definitions with anchored patterns", () => {
    const files = [
      {
        file: "/home/u/.bashrc",
        content:
          'safe() {\n  safehouse "$@"\n}\nsafe-claude () { safe claude; }\n',
      },
    ];
    const found = scanRcContents(files, [SAFE_FN, SAFE_CLAUDE_FN]);
    expect(found.get("safe")?.line).toBe(1);
    expect(found.get("safe-claude")?.line).toBe(4);
  });

  it("does not let `safe-claude()` match the `safe` target", () => {
    const files = [
      { file: "/home/u/.bashrc", content: "safe-claude() { :; }\n" },
    ];
    const found = scanRcContents(files, [SAFE_FN, SAFE_CLAUDE_FN]);
    expect(found.has("safe")).toBe(false);
    expect(found.has("safe-claude")).toBe(true);
  });

  it("first match wins across files in the given order", () => {
    const files = [
      {
        file: "/home/u/.zshrc",
        content: "export CLEARANCE_ALLOW_HOSTS_FILES=a\n",
      },
      {
        file: "/home/u/.bashrc",
        content: "export CLEARANCE_ALLOW_HOSTS_FILES=b\n",
      },
    ];
    expect(
      scanRcContents(files, [EXPORT_TARGET]).get("CLEARANCE_ALLOW_HOSTS_FILES")
        ?.value,
    ).toBe("a");
  });
});

describe("extractExportValue", () => {
  it("strips double quotes", () => {
    expect(extractExportValue('export FOO="/a b/c"', "FOO")).toBe("/a b/c");
  });
  it("strips single quotes", () => {
    expect(extractExportValue("export FOO='/x'", "FOO")).toBe("/x");
  });
  it("returns the raw value when unquoted", () => {
    expect(extractExportValue("export FOO=/x", "FOO")).toBe("/x");
  });
  it("returns null for a bare declaration", () => {
    expect(extractExportValue("export FOO", "FOO")).toBeNull();
  });
  it("returns null for an empty value", () => {
    expect(extractExportValue("export FOO=", "FOO")).toBeNull();
  });
});
