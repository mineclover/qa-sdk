/**
 * self-check-analyzer 단위 테스트.
 *
 * execSync 없음. 순수 분석 로직만 검증.
 * 실행 시간 < 100ms (빌드/테스트 실행 없이 mock 데이터로).
 *
 * 컨벤션:
 *   Layer 1 (SLOW) = CI에서 수집 → JSON 파일
 *   Layer 2 (FAST) = 이 테스트가 검증 → 순수 함수
 *   Layer 3 (STORE) = --apply 시에만 실행
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { analyzeSelfCheck, type SelfCheckResult } from "./self-check-analyzer.js";

// ── mock 데이터: 전체 성공 ──

const ALL_SUCCESS: SelfCheckResult[] = [
  { pkg: "spec-core", kind: "build", result: "success", durationMs: 1000 },
  { pkg: "cli", kind: "build", result: "success", durationMs: 800 },
  { pkg: "demo-snapshot", kind: "build", result: "success", durationMs: 500 },
  { pkg: "weighted-index", kind: "build", result: "success", durationMs: 600 },
  { pkg: "e2e", kind: "build", result: "skipped" },
  { pkg: "spec-core", kind: "test", result: "passed", tests: 355, passed: 355, failed: 0 },
  { pkg: "cli", kind: "test", result: "passed", tests: 107, passed: 107, failed: 0 },
  { pkg: "demo-snapshot", kind: "test", result: "passed", tests: 71, passed: 71, failed: 0 },
  { pkg: "weighted-index", kind: "test", result: "passed", tests: 993, passed: 993, failed: 0 },
];

// ── mock 데이터: 빌드 실패 포함 ──

const WITH_FAILURE: SelfCheckResult[] = [
  { pkg: "spec-core", kind: "build", result: "success" },
  { pkg: "engine", kind: "build", result: "type-error" },
  { pkg: "spec-core", kind: "test", result: "passed", tests: 355, passed: 355, failed: 0 },
  { pkg: "engine", kind: "test", result: "passed", tests: 133, passed: 133, failed: 0 },
];

// ── mock 데이터: 테스트 실패 포함 ──

const WITH_TEST_FAILURE: SelfCheckResult[] = [
  { pkg: "spec-core", kind: "build", result: "success" },
  { pkg: "sdk", kind: "build", result: "success" },
  { pkg: "spec-core", kind: "test", result: "passed", tests: 355, passed: 355, failed: 0 },
  { pkg: "sdk", kind: "test", result: "failed", tests: 58, passed: 55, failed: 3 },
];

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

describe("self-check-analyzer: Layer 2 순수 분석", () => {
  it("전체 성공 → invariant 0건, 빌드 요약 정확", () => {
    const analysis = analyzeSelfCheck(ALL_SUCCESS, DEMO_CATALOG, "test-run");

    expect(analysis.invariantViolations).toHaveLength(0);
    expect(analysis.buildSummary.success).toBe(4);
    expect(analysis.buildSummary.skipped).toBe(1);
    expect(analysis.buildSummary.failure).toBe(0);
    expect(analysis.testSummary.passed).toBe(1526);
    expect(analysis.testSummary.failed).toBe(0);
  });

  it("빌드 실패 + 테스트 실행 → invariant 위반 감지", () => {
    const analysis = analyzeSelfCheck(WITH_FAILURE, DEMO_CATALOG, "test-run");

    expect(analysis.invariantViolations.length).toBeGreaterThan(0);
    const engineViolation = analysis.invariantViolations.find(v => v.pkg === "engine");
    expect(engineViolation).toBeDefined();
    expect(engineViolation!.message).toContain("type-error");
  });

  it("테스트 실패 → testSummary에 반영", () => {
    const analysis = analyzeSelfCheck(WITH_TEST_FAILURE, DEMO_CATALOG, "test-run");

    expect(analysis.testSummary.failed).toBe(3);
    expect(analysis.testSummary.passed).toBe(410);
  });

  it("AddressContextRecord 인코딩 — build/test/biz 전부 생성", () => {
    const analysis = analyzeSelfCheck(ALL_SUCCESS, DEMO_CATALOG, "test-run");

    // build_event + test_event + biz prefix
    expect(analysis.records.length).toBeGreaterThan(0);
    const prefixes = new Set(analysis.records.map(r => Object.keys(r.address_context)[0]));
    expect(prefixes.has("build_event")).toBe(true);
    expect(prefixes.has("test_event")).toBe(true);
    // biz prefix (endpoint, permission, event)
    expect(analysis.bizRecords).toBeGreaterThan(0);
  });

  it("aggregateUsageData — entryUsage 생성", () => {
    const analysis = analyzeSelfCheck(ALL_SUCCESS, DEMO_CATALOG, "test-run");

    expect(analysis.usage.entryUsages.length).toBeGreaterThan(0);
    // qa_pkg 축의 entry가 관측됨
    const qaPkgEntries = analysis.usage.entryUsages.filter(e => e.axisId === "qa_pkg");
    expect(qaPkgEntries.length).toBeGreaterThan(0);
  });

  it("건전성 100% — 인코딩된 record는 모두 유효", () => {
    const analysis = analyzeSelfCheck(ALL_SUCCESS, DEMO_CATALOG, "test-run");

    expect(analysis.health.healthRate).toBe(1);
  });

  it("coverage — build_event/test_event 커버리지 계산", () => {
    const analysis = analyzeSelfCheck(ALL_SUCCESS, DEMO_CATALOG, "test-run");

    const buildCov = analysis.coverage.prefixes.find((p: { prefixId: string }) => p.prefixId === "build_event");
    expect(buildCov).toBeDefined();
    expect(buildCov!.coverageRate).toBeGreaterThan(0);
  });

  it("skipped 패키지는 invariant에서 제외", () => {
    const results: SelfCheckResult[] = [
      { pkg: "e2e", kind: "build", result: "skipped" },
      { pkg: "e2e", kind: "test", result: "error" },
    ];
    const analysis = analyzeSelfCheck(results, DEMO_CATALOG, "test-run");

    // e2e는 build=skipped이므로 "빌드 성공 선행" 규칙 적용 안 됨
    const e2eViolation = analysis.invariantViolations.find(v => v.pkg === "e2e");
    expect(e2eViolation).toBeUndefined();
  });

  it("빈 결과 → 분석 가능 (에러 없음)", () => {
    const analysis = analyzeSelfCheck([], DEMO_CATALOG, "test-run");

    expect(analysis.records.length).toBeGreaterThan(0); // biz records만
    expect(analysis.invariantViolations).toHaveLength(0);
    expect(analysis.buildSummary.total).toBe(0);
  });
});
