import { describe, expect, it } from "vitest";
import {
  GROUNDCREW_PACKAGE,
  parseBrewVersions,
  parseCrewVersion,
  parseNpmLs,
} from "./installProbe.ts";

describe("parseNpmLs", () => {
  it("reports installed with version when the package is a dependency", () => {
    const stdout = JSON.stringify({
      dependencies: { [GROUNDCREW_PACKAGE]: { version: "4.43.2" } },
    });
    expect(parseNpmLs(stdout, GROUNDCREW_PACKAGE)).toEqual({
      installed: true,
      version: "4.43.2",
    });
  });

  it("reports installed with null version when version is missing", () => {
    const stdout = JSON.stringify({
      dependencies: { [GROUNDCREW_PACKAGE]: {} },
    });
    expect(parseNpmLs(stdout, GROUNDCREW_PACKAGE)).toEqual({
      installed: true,
      version: null,
    });
  });

  it("reports not installed when dependencies lacks the package", () => {
    // npm ls -g exits non-zero here but still writes this valid JSON body;
    // the caller ignores the exit code and this parser keys off dependencies.
    const stdout = JSON.stringify({ dependencies: {} });
    expect(parseNpmLs(stdout, GROUNDCREW_PACKAGE).installed).toBe(false);
  });

  it.each(["", "not json", "[]", "42", JSON.stringify({ dependencies: 7 })])(
    "reports not installed for malformed stdout %j",
    (stdout) => {
      expect(parseNpmLs(stdout, GROUNDCREW_PACKAGE).installed).toBe(false);
    },
  );
});

describe("parseBrewVersions", () => {
  it("parses 'agent-safehouse 0.9.0'", () => {
    expect(parseBrewVersions("agent-safehouse 0.9.0\n")).toEqual({
      installed: true,
      version: "0.9.0",
    });
  });

  it("reports installed with null version for a bare formula name", () => {
    expect(parseBrewVersions("agent-safehouse\n")).toEqual({
      installed: true,
      version: null,
    });
  });

  it("reports null version when the second token is not version-like", () => {
    expect(parseBrewVersions("agent-safehouse HEAD-abc")).toEqual({
      installed: true,
      version: null,
    });
  });

  it("accepts version-with-suffix tokens like 1.2.3_1", () => {
    expect(parseBrewVersions("agent-safehouse 1.2.3_1").version).toBe(
      "1.2.3_1",
    );
  });

  it("reports not installed for empty output", () => {
    expect(parseBrewVersions("").installed).toBe(false);
  });
});

describe("parseCrewVersion", () => {
  it("parses a bare version line", () => {
    expect(parseCrewVersion("4.45.2\n")).toBe("4.45.2");
  });

  it("extracts the version from surrounding text", () => {
    expect(parseCrewVersion("crew v4.45.2 (build abc)")).toBe("4.45.2");
  });

  it("keeps a prerelease/suffix on the version token", () => {
    expect(parseCrewVersion("4.45.2-beta.1")).toBe("4.45.2-beta.1");
  });

  it.each(["", "no version here", "v", "42"])(
    "returns null when there is no dotted-numeric token %j",
    (stdout) => {
      expect(parseCrewVersion(stdout)).toBeNull();
    },
  );
});
