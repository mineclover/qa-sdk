import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  parseVersion,
  formatVersion,
  InvalidVersionError,
} from "../../lib/version.js";

describe("parseVersion", () => {
  it("parses a valid semver string", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("parses zero values", () => {
    expect(parseVersion("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it("throws for non-semver strings", () => {
    expect(() => parseVersion("001")).toThrow(InvalidVersionError);
    expect(() => parseVersion("1.2")).toThrow(InvalidVersionError);
    expect(() => parseVersion("a.b.c")).toThrow(InvalidVersionError);
    expect(() => parseVersion("")).toThrow(InvalidVersionError);
  });
});

describe("formatVersion", () => {
  it("formats a SemVer object to string", () => {
    expect(formatVersion({ major: 2, minor: 1, patch: 0 })).toBe("2.1.0");
  });
});

describe("bumpVersion", () => {
  it("returns 1.0.0 when no latest version exists regardless of bump type", () => {
    expect(bumpVersion(null, "major")).toBe("1.0.0");
    expect(bumpVersion(null, "minor")).toBe("1.0.0");
    expect(bumpVersion(null, "patch")).toBe("1.0.0");
  });

  it("bumps major: resets minor and patch to 0", () => {
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
    expect(bumpVersion("3.5.9", "major")).toBe("4.0.0");
  });

  it("bumps minor: resets patch to 0", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("2.0.0", "minor")).toBe("2.1.0");
  });

  it("bumps patch", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.0.0", "patch")).toBe("1.0.1");
  });

  it("handles large version numbers", () => {
    expect(bumpVersion("999.999.999", "major")).toBe("1000.0.0");
    expect(bumpVersion("1.999.0", "minor")).toBe("1.1000.0");
  });
});
