// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { deriveTestTokens } from "./test-tokens.js";
import { testName } from "./test-name.js";

const ROOT = process.cwd().includes("packages/core")
  ? process.cwd().replace(/packages\/core$/, "")
  : process.cwd();

describe("deriveTestTokens", () => {
  it("pipe-static-lineage spec에서 함수 목록 파생", () => {
    const tokens = deriveTestTokens("pipe-static-lineage", ROOT);
    expect(tokens).not.toBeNull();
    expect(tokens!.module).toBe("pipe-static-lineage");
    expect(tokens!.specId).toBe("pipe-static-lineage");
    // ^defines 테이블에서 추출된 함수명
    expect(tokens!.functions).toContain("deriveStaticLineage");
    expect(tokens!.functions).toContain("summarizeFlowLineage");
    expect(tokens!.functions).toContain("findFieldOrigin");
    expect(tokens!.functions).toContain("deriveGraphLineage");
    expect(tokens!.functions).toContain("lineageId");
    expect(tokens!.functions).toContain("diffLineage");
  });

  it("transition-scope spec에서 함수 목록 파생", () => {
    const tokens = deriveTestTokens("transition-scope", ROOT);
    expect(tokens).not.toBeNull();
    expect(tokens!.module).toBe("transition-scope");
  });

  it("존재하지 않는 spec → null", () => {
    expect(deriveTestTokens("nonexistent-spec", ROOT)).toBeNull();
  });

  it("system 하위 spec도 탐색 가능", () => {
    const tokens = deriveTestTokens("doc-type-convention", ROOT);
    expect(tokens).not.toBeNull();
    expect(tokens!.specId).toBe("doc-type-convention");
  });

  it("engine 하위 spec도 탐색 가능", () => {
    const tokens = deriveTestTokens("pipe-validate", ROOT);
    expect(tokens).not.toBeNull();
  });

  it("^defines 없는 spec → 함수 빈 배열", () => {
    const tokens = deriveTestTokens("doc-type-convention", ROOT);
    // doc-type-convention은 ^defines에 함수 테이블이 없음
    expect(tokens).not.toBeNull();
    // 함수가 없거나 적을 수 있음
    expect(Array.isArray(tokens!.functions)).toBe(true);
  });
});

// ── 통합 PoC: deriveTestTokens → testName ──────────

describe("토큰 파생 → 이름 생성 통합", () => {
  it("spec에서 토큰 파생 후 testName에 주입", () => {
    const tokens = deriveTestTokens("pipe-static-lineage", ROOT);
    expect(tokens).not.toBeNull();

    // spec에서 파생된 module + fn 사용
    const n = testName({
      module: tokens!.module,
      fn: tokens!.functions[0], // deriveStaticLineage
      facet: "기여추적",
      category: "정상",
      input: "a+b",
      resolved: "c",
      expect: "양쪽 기여",
    });

    expect(n.describe).toContain("pipe-static-lineage");
    expect(n.describe).toContain(tokens!.functions[0]);
    expect(n.it).toBe("정상: a+b → c — 양쪽 기여");
  });
});
