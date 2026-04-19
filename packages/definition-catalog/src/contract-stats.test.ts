// @def.doc definition-catalog-spec

import { describe, it, expect } from "vitest";
import { computeStats, extractPurpose, renderContract } from "./contract-stats.js";
import type { DefinitionEntry } from "./types.js";

describe("computeStats", () => {
  it("빈 섹션 → 0 밀도", () => {
    const stats = computeStats([], 0, []);
    expect(stats.totalSections).toBe(0);
    expect(stats.semanticDensity).toBe(0);
    expect(stats.completeness).toBe(0);
  });

  it("code+llm 섹션 의미 밀도 계산", () => {
    const sections = [
      { marker: "inputs" as const, markerDef: { modeHint: "code" as const }, sourceScope: "data", sourceId: "a", body: "" },
      { marker: "flow-steps" as const, markerDef: { modeHint: "llm" as const }, sourceScope: "flow", sourceId: "b", body: "" },
      { marker: "decision-point" as const, markerDef: { modeHint: "llm" as const }, sourceScope: "flow", sourceId: "c", body: "" },
    ];
    const stats = computeStats(sections, 2, []);
    expect(stats.totalSections).toBe(3);
    expect(stats.codeSections).toBe(1);
    expect(stats.llmSections).toBe(2);
    expect(stats.semanticDensity).toBeCloseTo(2 / 3);
    expect(stats.branchingFactor).toBe(2);
  });

  it("evidence 가역성 비율", () => {
    const evidence = [
      { description: "a", reversibility: "reversible" as const, sourceId: "x", raw: "a [reversible]" },
      { description: "b", reversibility: "irreversible" as const, sourceId: "x", raw: "b [irreversible]" },
      { description: "c", reversibility: null, sourceId: "x", raw: "c" },
    ];
    const stats = computeStats([], 0, evidence);
    expect(stats.evidenceReversibilityRatio).toBeCloseTo(1 / 3);
  });
});

describe("extractPurpose", () => {
  it("^purpose 마커 있으면 본문 반환", () => {
    const body = "# 제목\n\n## 목적 ^purpose\n\n이것은 목적입니다.\n\n## 다른 섹션\n\n내용";
    const purpose = extractPurpose(body);
    expect(purpose).toContain("이것은 목적입니다");
  });

  it("^purpose 없으면 null", () => {
    expect(extractPurpose("# 제목\n\n## 내용\n\n텍스트")).toBeNull();
  });
});
