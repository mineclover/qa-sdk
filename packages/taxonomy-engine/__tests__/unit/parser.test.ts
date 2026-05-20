import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

const MIN_YAML = `
taxonomy: test
version: 1
axes:
  scope:
    entries: [apm, ingest, registry]
`;

describe("parse", () => {
  it("최소 yaml을 IR로 변환한다", () => {
    const result = parse(MIN_YAML);
    expect("ir" in result).toBe(true);
    if ("ir" in result) {
      expect(result.ir.taxonomy).toBe("test");
      expect(result.ir.version).toBe(1);
      expect(result.ir.axes.get("scope")?.entries.length).toBe(3);
    }
  });

  it("entry id에 _loc(line)을 보존한다", () => {
    const result = parse(MIN_YAML);
    if ("ir" in result) {
      const apm = result.ir.axes.get("scope")?.entries[0];
      expect(apm?._loc?.line).toBeGreaterThan(0);
    }
  });

  it("syntax error 시 fail-fast로 ParseError 반환", () => {
    const result = parse(":::not yaml:::");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toMatch(/^parse-/);
    }
  });

  it("entries가 비면 structural-empty-entries 반환", () => {
    const bad = `taxonomy: t\nversion: 1\naxes:\n  s:\n    entries: []\n`;
    const result = parse(bad);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("structural-empty-entries");
    }
  });

  it("동일 yaml에 대해 동일 contentHash 생성", () => {
    const a = parse(MIN_YAML);
    const b = parse(MIN_YAML);
    if ("ir" in a && "ir" in b) {
      expect(a.ir.contentHash).toBe(b.ir.contentHash);
    }
  });
});
