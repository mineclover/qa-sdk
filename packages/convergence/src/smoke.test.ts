/**
 * @qa-sdk/convergence smoke test.
 *
 * 29개 소스 파일의 핵심 export가 정상 동작하는지 검증.
 * mock 데이터로 순수 함수만 호출 — 외부 의존 없음.
 */

import { describe, it, expect } from "vitest";
import {
  // 집계
  aggregateUsageData,
  analyzeCollectionHealth,
  // 측정
  analyzeEntryCoverage,
  analyzeSelfCheck,
  SELF_CHECK_PKG_NAMES,
  // 비교
  compareAxes,
  comparePrefixes,
  scanAxisOverlaps,
  // 추천
  analyzeHeadroom,
  optimalCapacity,
  // 패턴 분류
  classifyPattern,
  DEMO_PATTERN_RULES,
  SYSTEM_PATTERN_RULES,
  SHOPPING_PATTERN_RULES,
  combinePatternRules,
  detectAnomalies,
  aggregatePatternStats,
  // 오케스트레이터
  runConvergenceAnalysis,
  // 필터
  filterUsageByCategory,
  // scaffold
  scaffoldDecision,
  // types
  type AddressContextRecord,
  type SelfCheckResult,
  type ClassifierInput,
  type CoverageReport,
  type UsageData,
} from "./index.js";
import { DEMO_CATALOG } from "demo-snapshot";

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

const NOW = "2026-03-23T00:00:00Z";

const MOCK_SELF_CHECK_RESULTS: SelfCheckResult[] = [
  { pkg: "spec-core", kind: "build", result: "success", durationMs: 1000 },
  { pkg: "cli", kind: "build", result: "success", durationMs: 800 },
  { pkg: "demo-snapshot", kind: "build", result: "success", durationMs: 500 },
  { pkg: "weighted-index", kind: "build", result: "success", durationMs: 600 },
  { pkg: "spec-core", kind: "test", result: "passed", tests: 355, passed: 355, failed: 0 },
  { pkg: "cli", kind: "test", result: "passed", tests: 107, passed: 107, failed: 0 },
  { pkg: "demo-snapshot", kind: "test", result: "passed", tests: 71, passed: 71, failed: 0 },
  { pkg: "weighted-index", kind: "test", result: "passed", tests: 993, passed: 993, failed: 0 },
];

/** 최소한의 address_context mock — service prefix 사용 */
const MOCK_RECORDS: AddressContextRecord[] = [
  {
    address_context: { service: "service:v1:0" },
    timestamp: NOW,
    trace_id: "trace-1",
    session_id: "sess-1",
    event_key: "page.home",
  },
  {
    address_context: { service: "service:v1:1" },
    timestamp: NOW,
    trace_id: "trace-2",
    session_id: "sess-1",
    event_key: "cart.add",
  },
  {
    address_context: { service: "service:v1:0" },
    timestamp: "2026-03-23T00:01:00Z",
    trace_id: "trace-3",
    session_id: "sess-2",
    event_key: "page.detail",
  },
];

// ═══════════════════════════════════════════════════════════════
//  1. Exports exist
// ═══════════════════════════════════════════════════════════════

describe("exports exist", () => {
  it("key functions are importable", () => {
    expect(typeof aggregateUsageData).toBe("function");
    expect(typeof analyzeCollectionHealth).toBe("function");
    expect(typeof analyzeEntryCoverage).toBe("function");
    expect(typeof analyzeSelfCheck).toBe("function");
    expect(typeof compareAxes).toBe("function");
    expect(typeof comparePrefixes).toBe("function");
    expect(typeof scanAxisOverlaps).toBe("function");
    expect(typeof analyzeHeadroom).toBe("function");
    expect(typeof optimalCapacity).toBe("function");
    expect(typeof classifyPattern).toBe("function");
    expect(typeof detectAnomalies).toBe("function");
    expect(typeof aggregatePatternStats).toBe("function");
    expect(typeof runConvergenceAnalysis).toBe("function");
    expect(typeof filterUsageByCategory).toBe("function");
    expect(typeof scaffoldDecision).toBe("function");
    expect(typeof combinePatternRules).toBe("function");
  });

  it("SELF_CHECK_PKG_NAMES is a non-empty array", () => {
    expect(Array.isArray(SELF_CHECK_PKG_NAMES)).toBe(true);
    expect(SELF_CHECK_PKG_NAMES.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. analyzeSelfCheck
// ═══════════════════════════════════════════════════════════════

describe("analyzeSelfCheck", () => {
  it("returns valid analysis with all-success results", () => {
    const analysis = analyzeSelfCheck(MOCK_SELF_CHECK_RESULTS, DEMO_CATALOG, "smoke-test");

    expect(analysis.records.length).toBeGreaterThan(0);
    expect(analysis.coverage.overallCoverageRate).toBeGreaterThanOrEqual(0);
    expect(analysis.health.healthRate).toBe(1);
    expect(analysis.invariantViolations).toHaveLength(0);
    expect(analysis.buildSummary.success).toBe(4);
    expect(analysis.buildSummary.failure).toBe(0);
    expect(analysis.testSummary.failed).toBe(0);
  });

  it("detects invariant violations on build failure + test run", () => {
    const results: SelfCheckResult[] = [
      { pkg: "engine", kind: "build", result: "type-error" },
      { pkg: "engine", kind: "test", result: "passed", tests: 10, passed: 10, failed: 0 },
    ];
    const analysis = analyzeSelfCheck(results, DEMO_CATALOG, "smoke-test");

    expect(analysis.invariantViolations.length).toBeGreaterThan(0);
    const violation = analysis.invariantViolations.find(v => v.pkg === "engine");
    expect(violation).toBeDefined();
  });

  it("handles empty results without error", () => {
    const analysis = analyzeSelfCheck([], DEMO_CATALOG, "smoke-test");

    expect(analysis.invariantViolations).toHaveLength(0);
    expect(analysis.buildSummary.total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. aggregateUsageData
// ═══════════════════════════════════════════════════════════════

describe("aggregateUsageData", () => {
  it("aggregates records into UsageData", () => {
    const usage = aggregateUsageData(DEMO_CATALOG, MOCK_RECORDS);

    expect(usage.entryUsages).toBeDefined();
    expect(usage.addressUsages).toBeDefined();
    expect(usage.coOccurrences).toBeDefined();
    expect(usage.collectionPeriod).toBeDefined();
    expect(usage.collectionPeriod.from).toBeTruthy();
    expect(usage.collectionPeriod.to).toBeTruthy();
  });

  it("handles empty records", () => {
    const usage = aggregateUsageData(DEMO_CATALOG, []);

    expect(usage.entryUsages).toHaveLength(0);
    expect(usage.addressUsages).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. analyzeEntryCoverage
// ═══════════════════════════════════════════════════════════════

describe("analyzeEntryCoverage", () => {
  it("returns CoverageReport from usage data", () => {
    const usage = aggregateUsageData(DEMO_CATALOG, MOCK_RECORDS);
    const report = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);

    expect(report.prefixes).toBeDefined();
    expect(Array.isArray(report.prefixes)).toBe(true);
    expect(report.overallCoverageRate).toBeGreaterThanOrEqual(0);
    expect(report.overallCoverageRate).toBeLessThanOrEqual(1);
    expect(typeof report.dormantCount).toBe("number");
    expect(typeof report.phantomCount).toBe("number");
    expect(typeof report.summary).toBe("string");
  });

  it("reports zero coverage with empty usage", () => {
    const report = analyzeEntryCoverage(DEMO_CATALOG, [], []);

    expect(report.overallCoverageRate).toBe(0);
    expect(report.dormantCount).toBeGreaterThan(0); // catalog has entries, none observed
  });
});

// ═══════════════════════════════════════════════════════════════
//  5. classifyPattern
// ═══════════════════════════════════════════════════════════════

describe("classifyPattern", () => {
  it("classifies purchase_complete sequence", () => {
    const input: ClassifierInput = {
      sessionId: "sess-1",
      events: [
        { event_key: "auth.login", timestamp: "2026-03-23T00:00:00Z", actor_id: "actor-1", user_id: "user-1" },
        { event_key: "cart.add", timestamp: "2026-03-23T00:01:00Z", actor_id: "actor-1", user_id: "user-1" },
        { event_key: "checkout.start", timestamp: "2026-03-23T00:02:00Z", actor_id: "actor-1", user_id: "user-1" },
        { event_key: "payment.success", timestamp: "2026-03-23T00:03:00Z", actor_id: "actor-1", user_id: "user-1" },
        { event_key: "order.complete", timestamp: "2026-03-23T00:04:00Z", actor_id: "actor-1", user_id: "user-1" },
      ],
    };
    const result = classifyPattern(input, DEMO_PATTERN_RULES);

    expect(result.pattern).toBe("purchase_complete");
    expect(result.identificationMode).toBe("identified");
    expect(result.confidence).toBe("exact");
  });

  it("classifies anonymous browse", () => {
    const input: ClassifierInput = {
      sessionId: "sess-anon",
      events: [
        { event_key: "page.home", timestamp: "2026-03-23T00:00:00Z" },
        { event_key: "page.detail", timestamp: "2026-03-23T00:01:00Z" },
      ],
    };
    const result = classifyPattern(input, DEMO_PATTERN_RULES);

    expect(result.pattern).toBe("anonymous_browse");
    expect(result.identificationMode).toBe("anonymous");
  });

  it("returns unclassified for empty events", () => {
    const input: ClassifierInput = { events: [] };
    const result = classifyPattern(input, DEMO_PATTERN_RULES);

    expect(result.pattern).toBe("unclassified");
  });

  it("classifies cart_abandon (cart without checkout)", () => {
    const input: ClassifierInput = {
      sessionId: "sess-abandon",
      events: [
        { event_key: "page.home", timestamp: "2026-03-23T00:00:00Z", actor_id: "user-2" },
        { event_key: "cart.add", timestamp: "2026-03-23T00:01:00Z", actor_id: "user-2" },
        { event_key: "page.detail", timestamp: "2026-03-23T00:02:00Z", actor_id: "user-2" },
      ],
    };
    const result = classifyPattern(input, DEMO_PATTERN_RULES);

    expect(result.pattern).toBe("cart_abandon");
  });
});

// ═══════════════════════════════════════════════════════════════
//  6. DEMO_PATTERN_RULES
// ═══════════════════════════════════════════════════════════════

describe("DEMO_PATTERN_RULES", () => {
  it("exists and has rules", () => {
    expect(Array.isArray(DEMO_PATTERN_RULES)).toBe(true);
    expect(DEMO_PATTERN_RULES.length).toBeGreaterThan(0);
  });

  it("includes system + shopping rules", () => {
    expect(SYSTEM_PATTERN_RULES.length).toBeGreaterThan(0);
    expect(SHOPPING_PATTERN_RULES.length).toBeGreaterThan(0);
    expect(DEMO_PATTERN_RULES.length).toBe(
      SYSTEM_PATTERN_RULES.length + SHOPPING_PATTERN_RULES.length,
    );
  });

  it("every rule has required fields", () => {
    for (const rule of DEMO_PATTERN_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.behaviorPattern).toBeTruthy();
      expect(rule.identificationMode).toBeTruthy();
      expect(rule.defaultConfidence).toBeTruthy();
      expect(typeof rule.priority).toBe("number");
      expect(rule.match).toBeDefined();
    }
  });

  it("combinePatternRules merges system + custom", () => {
    const custom = [{ id: "rule-custom", identificationMode: "any" as const, behaviorPattern: "custom" as any, defaultConfidence: "medium" as const, priority: 999, match: { requiredKeys: ["custom.*"] } }];
    const combined = combinePatternRules(custom);

    expect(combined.length).toBe(SYSTEM_PATTERN_RULES.length + 1);
    // 최고 priority가 첫 번째
    expect(combined[0].id).toBe("rule-custom");
  });
});
