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

  it("블록 스타일 entries의 _loc 보존", () => {
    const blockYaml = `
taxonomy: bt
version: 1
axes:
  scope:
    entries:
      - apm
      - ingest
      - { id: registry, address: 5 }
`;
    const r = parse(blockYaml);
    if (!("ir" in r)) throw new Error();
    const entries = r.ir.axes.get("scope")?.entries ?? [];
    expect(entries.length).toBe(3);
    // 각 entry에 _loc 있어야
    for (const e of entries) {
      expect(e._loc?.line).toBeGreaterThan(0);
    }
    // line이 strictly 증가
    expect(entries[1]._loc!.line).toBeGreaterThan(entries[0]._loc!.line);
    expect(entries[2]._loc!.line).toBeGreaterThan(entries[1]._loc!.line);
  });
});

describe("_loc AST 정확성", () => {
  it("multi-line description이 있어도 entries의 _loc 정확", () => {
    const yaml = `
taxonomy: t
version: 1
description: |
  여러 줄
  설명입니다
  multi-line
axes:
  scope:
    description: |
      scope 축
      설명
    entries: [apm, ingest]
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const entries = r.ir.axes.get("scope")?.entries ?? [];
    expect(entries.length).toBe(2);
    expect(entries[0]._loc?.line).toBeGreaterThan(0);
    expect(entries[1]._loc?.line).toBeGreaterThan(0);
  });

  it("comments가 있어도 _loc 정확", () => {
    const yaml = `
# 최상위 코멘트
taxonomy: t
version: 1
axes:
  # axis 코멘트
  scope:
    # entries 위 코멘트
    entries:
      - apm    # inline 코멘트
      - ingest # 또 다른 코멘트
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const entries = r.ir.axes.get("scope")?.entries ?? [];
    expect(entries.length).toBe(2);
    expect(entries[0]._loc?.line).toBeGreaterThan(0);
    expect(entries[1]._loc?.line).toBe(entries[0]._loc!.line + 1);
  });

  it("nested 객체 entry의 _loc도 정확", () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  s:
    entries:
      - id: a
        address: 0
        label: Alpha
      - id: b
        address: 1
        meta:
          owner: team-x
`;
    const r = parse(yaml);
    if (!("ir" in r)) throw new Error();
    const entries = r.ir.axes.get("s")?.entries ?? [];
    expect(entries.length).toBe(2);
    expect(entries[0]._loc?.line).toBeGreaterThan(0);
    expect(entries[1]._loc?.line).toBeGreaterThan(entries[0]._loc!.line);
  });
});
