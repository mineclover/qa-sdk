// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 실전 시나리오 — 주문 시스템 테스트 추적 통합 테스트
 */

import { describe, it, expect } from "vitest";
import { TestRegistry } from "./test-tracking.js";

describe("실전: 주문 시스템 테스트 추적", () => {
  it("패싯별 스위트 → 결과 수집 → 품질 대시보드", () => {
    const reg = new TestRegistry();

    reg.registerSuite({
      suiteId: "orders-소비",
      facet: "소비",
      scope: "feature",
      aspect: "func_def",
      cases: [
        { testId: "oc1", address: "test:1:3:소비:1", name: "주문 입력 정상", target: { specId: "order-spec" }, expected: { type: "pass" }, facet: "소비" },
        { testId: "oc2", address: "test:1:3:소비:2", name: "필드 누락 거부", target: { specId: "order-spec", constraintRef: "rule-1" }, expected: { type: "fail" }, facet: "소비", contractRef: "order-spec#rule-1" },
      ],
    });

    reg.registerSuite({
      suiteId: "orders-관리",
      facet: "관리",
      cases: [
        { testId: "om1", address: "test:5:1:관리:1", name: "재고 검증 통과", target: { specId: "order-spec" }, expected: { type: "pass" }, facet: "관리" },
        { testId: "om2", address: "test:5:1:관리:2", name: "재고 부족 실패", target: { specId: "order-spec", constraintRef: "rule-2" }, expected: { type: "fail" }, facet: "관리", contractRef: "order-spec#rule-2" },
      ],
    });

    reg.recordResults([
      { testId: "oc1", address: "test:1:3:소비:1", status: "pass", duration: 5, executedAt: "2026-04-01T10:00:00Z" },
      { testId: "oc2", address: "test:1:3:소비:2", status: "pass", duration: 3, executedAt: "2026-04-01T10:00:01Z" },
      { testId: "om1", address: "test:5:1:관리:1", status: "pass", duration: 8, executedAt: "2026-04-01T10:00:02Z" },
      { testId: "om2", address: "test:5:1:관리:2", status: "fail", duration: 12, executedAt: "2026-04-01T10:00:03Z" },
    ]);

    const consumeMetrics = reg.computeFacetMetrics("소비");
    expect(consumeMetrics.passRate).toBe(100);
    expect(consumeMetrics.hasCoverage).toBe(true);

    const manageMetrics = reg.computeFacetMetrics("관리");
    expect(manageMetrics.passRate).toBe(50);

    const overall = reg.getOverallStatus();
    expect(overall.totalCases).toBe(4);
    expect(overall.passRate).toBe(75);
    expect(overall.failures).toBe(1);

    const failures = reg.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].testId).toBe("om2");
  });
});
