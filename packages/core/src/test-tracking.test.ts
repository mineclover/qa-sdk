import { describe, it, expect } from "vitest";
import {
  buildTestAddress, parseTestAddress, TestRegistry,
} from "./test-tracking.js";
import type { TestCase, TestSuite, TestResult } from "./types/test-tracking.js";
import type { PipeSpec, PipeFlow } from "./types/pipe-spec.js";

const step = (facet: string): PipeFlow => ({ kind: "step", facet });

// ── 주소 ─────────────────────────────────────────────

describe("테스트 주소", () => {
  it("buildTestAddress", () => {
    expect(buildTestAddress(1, 3, "소비", 2)).toBe("test:1:3:소비:2");
  });

  it("parseTestAddress", () => {
    const parsed = parseTestAddress("test:1:3:소비:2");
    expect(parsed).toEqual({ scopeIndex: 1, aspectIndex: 3, facet: "소비", seq: 2 });
  });

  it("parseTestAddress — 잘못된 형식 → null", () => {
    expect(parseTestAddress("invalid")).toBeNull();
  });
});

// ── TestRegistry ─────────────────────────────────────

describe("TestRegistry", () => {
  function makeCase(id: string, facet: string, specId: string, contractRef?: string): TestCase {
    return {
      testId: id,
      address: buildTestAddress(1, 1, facet, Number(id.replace(/\D/g, "")) || 1),
      name: `test ${id}`,
      target: { specId, constraintRef: contractRef },
      expected: { type: "pass" },
      facet,
      contractRef,
    };
  }

  function makeResult(testId: string, status: TestResult["status"]): TestResult {
    return {
      testId,
      address: `test:1:1:소비:1`,
      status,
      duration: 10,
      executedAt: new Date().toISOString(),
    };
  }

  describe("케이스 관리", () => {
    it("등록 + 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "spec1"));
      expect(reg.getCase("t1")).not.toBeNull();
      expect(reg.getCase("t1")!.facet).toBe("소비");
    });

    it("스펙별 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "spec1"));
      reg.registerCase(makeCase("t2", "관리", "spec1"));
      reg.registerCase(makeCase("t3", "소비", "spec2"));
      expect(reg.getCasesBySpec("spec1")).toHaveLength(2);
      expect(reg.getCasesBySpec("spec2")).toHaveLength(1);
    });

    it("패싯별 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.registerCase(makeCase("t2", "소비", "s2"));
      reg.registerCase(makeCase("t3", "관리", "s1"));
      expect(reg.getCasesByFacet("소비")).toHaveLength(2);
    });
  });

  describe("스위트 관리", () => {
    it("스위트 등록 → 내부 케이스 자동 등록", () => {
      const reg = new TestRegistry();
      const suite: TestSuite = {
        suiteId: "s1",
        facet: "소비",
        cases: [makeCase("t1", "소비", "spec1"), makeCase("t2", "소비", "spec1")],
      };
      reg.registerSuite(suite);
      expect(reg.getSuite("s1")).not.toBeNull();
      expect(reg.listCases()).toHaveLength(2);
    });

    it("패싯별 스위트 조회", () => {
      const reg = new TestRegistry();
      reg.registerSuite({ suiteId: "s1", facet: "소비", cases: [makeCase("t1", "소비", "s")] });
      reg.registerSuite({ suiteId: "s2", facet: "관리", cases: [makeCase("t2", "관리", "s")] });
      reg.registerSuite({ suiteId: "s3", facet: "소비", cases: [makeCase("t3", "소비", "s")] });
      expect(reg.getSuitesByFacet("소비")).toHaveLength(2);
    });
  });

  describe("결과 수집", () => {
    it("결과 기록 + 최신 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.recordResult(makeResult("t1", "fail"));
      reg.recordResult(makeResult("t1", "pass")); // 재실행 후 통과

      const latest = reg.getLatestResult("t1");
      expect(latest?.status).toBe("pass");
    });

    it("실패 목록 (최신 결과 기준)", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.registerCase(makeCase("t2", "관리", "s1"));
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "fail"));
      expect(reg.getFailures()).toHaveLength(1);
      expect(reg.getFailures()[0].testId).toBe("t2");
    });
  });

  describe("패싯 품질 지표", () => {
    it("통과율 계산", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.registerCase(makeCase("t2", "소비", "s1"));
      reg.registerCase(makeCase("t3", "소비", "s1"));
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "pass"));
      reg.recordResult(makeResult("t3", "fail"));

      const m = reg.computeFacetMetrics("소비");
      expect(m.totalTests).toBe(3);
      expect(m.passedTests).toBe(2);
      expect(m.passRate).toBe(67);
      expect(m.hasCoverage).toBe(true);
    });

    it("drift 감지 — 스키마 변경 후 미실행", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.recordResult({ ...makeResult("t1", "pass"), executedAt: "2026-03-01T00:00:00Z" });

      const m = reg.computeFacetMetrics("소비", "2026-04-01T00:00:00Z");
      expect(m.hasDrift).toBe(true); // 3/1 실행 < 4/1 변경
    });

    it("drift 없음 — 스키마 변경 후 재실행", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.recordResult({ ...makeResult("t1", "pass"), executedAt: "2026-04-02T00:00:00Z" });

      const m = reg.computeFacetMetrics("소비", "2026-04-01T00:00:00Z");
      expect(m.hasDrift).toBe(false);
    });

    it("contract 검증률", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1", "rule-1"));
      reg.registerCase(makeCase("t2", "소비", "s1", "rule-2"));
      reg.registerCase(makeCase("t3", "소비", "s1")); // contract 없음
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "fail"));
      reg.recordResult(makeResult("t3", "pass"));

      const m = reg.computeFacetMetrics("소비");
      expect(m.contractVerifiedRate).toBe(50); // 1/2 contract 통과
    });

    it("커버리지 없음", () => {
      const reg = new TestRegistry();
      const m = reg.computeFacetMetrics("정의");
      expect(m.hasCoverage).toBe(false);
      expect(m.totalTests).toBe(0);
    });
  });

  describe("파이프 품질 지표", () => {
    it("경로 커버리지 + 패싯 분포", () => {
      const reg = new TestRegistry();
      const pipe: PipeSpec = {
        pipeId: "order-process", version: "v1",
        trigger: { eventKey: "start" },
        flow: { kind: "branch", condition: "x", paths: [step("소비"), step("생산")] },
      };

      reg.registerCase({ ...makeCase("t1", "소비", "order-process"), tags: ["order-process"] });
      reg.registerCase({ ...makeCase("t2", "생산", "order-process"), tags: ["order-process"] });
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "pass"));

      const m = reg.computePipeMetrics(pipe);
      expect(m.totalPaths).toBe(2);
      expect(m.testedPaths).toBe(2);
      expect(m.pathCoverage).toBe(100);
      expect(m.facetDistribution["소비"]).toBe(1);
      expect(m.facetDistribution["생산"]).toBe(1);
      expect(m.uncoveredFacets).toContain("관리");
      expect(m.uncoveredFacets).toContain("저장");
    });
  });

  describe("전체 현황", () => {
    it("종합 현황", () => {
      const reg = new TestRegistry();
      reg.registerSuite({ suiteId: "s1", facet: "소비", cases: [
        makeCase("t1", "소비", "s1"),
        makeCase("t2", "소비", "s1"),
      ]});
      reg.registerSuite({ suiteId: "s2", facet: "관리", cases: [
        makeCase("t3", "관리", "s1"),
      ]});

      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "pass"));
      reg.recordResult(makeResult("t3", "fail"));

      const status = reg.getOverallStatus();
      expect(status.totalCases).toBe(3);
      expect(status.totalSuites).toBe(2);
      expect(status.passRate).toBe(67);
      expect(status.failures).toBe(1);
    });
  });
});

// ── 실전 시나리오 ────────────────────────────────────

describe("실전: 주문 시스템 테스트 추적", () => {
  it("패싯별 스위트 → 결과 수집 → 품질 대시보드", () => {
    const reg = new TestRegistry();

    // 주문 소비 테스트 스위트
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

    // 주문 관리 테스트 스위트
    reg.registerSuite({
      suiteId: "orders-관리",
      facet: "관리",
      cases: [
        { testId: "om1", address: "test:5:1:관리:1", name: "재고 검증 통과", target: { specId: "order-spec" }, expected: { type: "pass" }, facet: "관리" },
        { testId: "om2", address: "test:5:1:관리:2", name: "재고 부족 실패", target: { specId: "order-spec", constraintRef: "rule-2" }, expected: { type: "fail" }, facet: "관리", contractRef: "order-spec#rule-2" },
      ],
    });

    // 결과 수집
    reg.recordResults([
      { testId: "oc1", address: "test:1:3:소비:1", status: "pass", duration: 5, executedAt: "2026-04-01T10:00:00Z" },
      { testId: "oc2", address: "test:1:3:소비:2", status: "pass", duration: 3, executedAt: "2026-04-01T10:00:01Z" },
      { testId: "om1", address: "test:5:1:관리:1", status: "pass", duration: 8, executedAt: "2026-04-01T10:00:02Z" },
      { testId: "om2", address: "test:5:1:관리:2", status: "fail", duration: 12, executedAt: "2026-04-01T10:00:03Z" },
    ]);

    // 패싯별 품질
    const consumeMetrics = reg.computeFacetMetrics("소비");
    expect(consumeMetrics.passRate).toBe(100);
    expect(consumeMetrics.hasCoverage).toBe(true);

    const manageMetrics = reg.computeFacetMetrics("관리");
    expect(manageMetrics.passRate).toBe(50);
    expect(manageMetrics.hasCoverage).toBe(true);

    // 전체 현황
    const overall = reg.getOverallStatus();
    expect(overall.totalCases).toBe(4);
    expect(overall.passRate).toBe(75);
    expect(overall.failures).toBe(1);

    // 실패 목록
    const failures = reg.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].testId).toBe("om2");
  });
});

// ── 시뮬레이션 비교 ─────────────────────────────────────

import type { SimulationResult } from "./pipe-simulate.js";

describe("compareWithSimulation", () => {
  it("시뮬 결과와 happy path 일치 → drift 없음", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [],
      pipeTrace: ["validate", "charge", "receipt"],
      facetTrace: ["검증", "결제", "영수증"],
      producedEvents: [],
      status: "complete",
      totalTime: 0,
      totalSteps: 3,
    };
    const { drift, match } = reg.compareWithSimulation("happy-order", {
      expectedPipeTrace: ["validate", "charge", "receipt"],
    }, simResult);
    expect(drift).toBe(false);
    expect(match.match).toBe(true);
  });

  it("시뮬 결과와 happy path 불일치 → drift 감지", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [],
      pipeTrace: ["validate", "refund"],
      facetTrace: ["검증", "환불"],
      producedEvents: [],
      status: "complete",
      totalTime: 0,
      totalSteps: 2,
    };
    const { drift, match, scenarioId } = reg.compareWithSimulation("happy-order", {
      expectedPipeTrace: ["validate", "charge", "receipt"],
    }, simResult);
    expect(drift).toBe(true);
    expect(match.divergedAtIndex).toBe(1);
    expect(scenarioId).toBe("happy-order");
  });

  it("패싯 불일치만으로도 drift", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [],
      pipeTrace: ["a", "b"],
      facetTrace: ["소비", "저장"],
      producedEvents: [],
      status: "complete",
      totalTime: 0,
      totalSteps: 2,
    };
    const { drift, match } = reg.compareWithSimulation("s1", {
      expectedPipeTrace: ["a", "b"],
      expectedFacets: ["소비", "생산"],
    }, simResult);
    expect(drift).toBe(true);
    expect(match.pipeTraceMatch).toBe(true);
    expect(match.facetMatch).toBe(false);
  });

  it("빈 트레이스 양쪽 → drift 없음", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: [], facetTrace: [],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 0,
    };
    const { drift } = reg.compareWithSimulation("empty", {
      expectedPipeTrace: [],
    }, simResult);
    expect(drift).toBe(false);
  });

  it("max-steps-reached 상태여도 비교는 수행", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["a", "b"], facetTrace: [],
      producedEvents: [], status: "max-steps-reached", totalTime: 0, totalSteps: 2,
    };
    const { drift, match } = reg.compareWithSimulation("s1", {
      expectedPipeTrace: ["a", "b"],
    }, simResult);
    // status와 무관하게 pipeTrace 비교
    expect(drift).toBe(false);
    expect(match.match).toBe(true);
  });

  it("같은 scenarioId로 여러 번 호출 — 멱등", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["a"], facetTrace: [],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 1,
    };
    const r1 = reg.compareWithSimulation("s1", { expectedPipeTrace: ["a"] }, simResult);
    const r2 = reg.compareWithSimulation("s1", { expectedPipeTrace: ["a"] }, simResult);
    expect(r1.drift).toBe(r2.drift);
    expect(r1.match.match).toBe(r2.match.match);
  });
});
