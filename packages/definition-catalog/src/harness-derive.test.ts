// @def.doc definition-harness

import { describe, it, expect } from "vitest";
import {
  deriveDocLifecycle,
  deriveSyncState,
  deriveSpecImplState,
  deriveConventionState,
  deriveVersionLifecycle,
  deriveFlowState,
  derivePolicyState,
  deriveAddressState,
  deriveServiceStatus,
  deriveEventStatus,
  deriveMetricHealth,
  deriveAllStates,
} from "./harness-derive.js";

// ═══════════════════════════════════════════════════════════════
// Group A: 직접 매핑
// ═══════════════════════════════════════════════════════════════

describe("deriveDocLifecycle", () => {
  it("유효한 lifecycle → 그대로 반환", () => {
    expect(deriveDocLifecycle("approved")).toBe("approved");
    expect(deriveDocLifecycle("draft")).toBe("draft");
    expect(deriveDocLifecycle("deprecated")).toBe("deprecated");
  });

  it("유효하지 않은 값 → draft", () => {
    expect(deriveDocLifecycle("unknown")).toBe("draft");
    expect(deriveDocLifecycle("")).toBe("draft");
  });
});

describe("deriveSyncState", () => {
  it("config 없음 → out-of-sync", () => {
    expect(deriveSyncState({ configExists: false, configCount: 0, scanCount: 10, checksumMatch: false }))
      .toBe("out-of-sync");
  });

  it("문서 수 불일치 → drift-detected", () => {
    expect(deriveSyncState({ configExists: true, configCount: 10, scanCount: 12, checksumMatch: true }))
      .toBe("drift-detected");
  });

  it("checksum 불일치 → drift-detected", () => {
    expect(deriveSyncState({ configExists: true, configCount: 10, scanCount: 10, checksumMatch: false }))
      .toBe("drift-detected");
  });

  it("전부 일치 → synced", () => {
    expect(deriveSyncState({ configExists: true, configCount: 10, scanCount: 10, checksumMatch: true }))
      .toBe("synced");
  });
});

// ═══════════════════════════════════════════════════════════════
// Group B: 규칙 기반 추론
// ═══════════════════════════════════════════════════════════════

describe("deriveSpecImplState", () => {
  it("소스 참조만 → source-referenced", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: true, hasTests: true, testsPass: true, isSourceReferenced: true }))
      .toBe("source-referenced");
  });

  it("svc 없음 → designed", () => {
    expect(deriveSpecImplState({ hasSvc: false, hasCode: false, hasTests: false, testsPass: null, isSourceReferenced: false }))
      .toBe("designed");
  });

  it("svc 있지만 코드 없음 → designed", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: false, hasTests: false, testsPass: null, isSourceReferenced: false }))
      .toBe("designed");
  });

  it("코드 있고 테스트 없음 → implementing", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: true, hasTests: false, testsPass: null, isSourceReferenced: false }))
      .toBe("implementing");
  });

  it("코드 + 테스트 있지만 미통과 → implemented", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: true, hasTests: true, testsPass: false, isSourceReferenced: false }))
      .toBe("implemented");
  });

  it("코드 + 테스트 있고 통과 → verified", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: true, hasTests: true, testsPass: true, isSourceReferenced: false }))
      .toBe("verified");
  });

  it("코드 + 테스트 있지만 결과 미확인 → implemented", () => {
    expect(deriveSpecImplState({ hasSvc: true, hasCode: true, hasTests: true, testsPass: null, isSourceReferenced: false }))
      .toBe("implemented");
  });
});

describe("deriveConventionState", () => {
  it("실패 있음 → violated", () => {
    expect(deriveConventionState({ evidenceCount: 5, coverage: 80, hasFailures: true }))
      .toBe("violated");
  });

  it("증거 0건 → unverified", () => {
    expect(deriveConventionState({ evidenceCount: 0, coverage: 0, hasFailures: false }))
      .toBe("unverified");
  });

  it("coverage 100% → compliant", () => {
    expect(deriveConventionState({ evidenceCount: 10, coverage: 100, hasFailures: false }))
      .toBe("compliant");
  });

  it("coverage < 100% → partial", () => {
    expect(deriveConventionState({ evidenceCount: 5, coverage: 60, hasFailures: false }))
      .toBe("partial");
  });
});

// ═══════════════════════════════════════════════════════════════
// Group C: 외부 Store 직접 읽기
// ═══════════════════════════════════════════════════════════════

describe("deriveVersionLifecycle", () => {
  it("유효한 status → 그대로 매핑", () => {
    expect(deriveVersionLifecycle("active")).toBe("active");
    expect(deriveVersionLifecycle("deprecated")).toBe("deprecated");
  });

  it("null → draft", () => {
    expect(deriveVersionLifecycle(null)).toBe("draft");
  });

  it("유효하지 않은 값 → draft", () => {
    expect(deriveVersionLifecycle("invalid")).toBe("draft");
  });
});

describe("deriveFlowState", () => {
  it("유효한 status → 그대로 매핑", () => {
    expect(deriveFlowState("completed")).toBe("completed");
    expect(deriveFlowState("blocked")).toBe("blocked");
  });

  it("null → pending", () => {
    expect(deriveFlowState(null)).toBe("pending");
  });
});

describe("derivePolicyState", () => {
  it("유효한 status → 그대로 매핑", () => {
    expect(derivePolicyState("approved")).toBe("approved");
  });

  it("null → candidate", () => {
    expect(derivePolicyState(null)).toBe("candidate");
  });
});

// ═══════════════════════════════════════════════════════════════
// Group D: 시스템 관측
// ═══════════════════════════════════════════════════════════════

describe("deriveAddressState", () => {
  it("encode✓ decode✓ → active", () => {
    expect(deriveAddressState({ allDimsEncode: true, allDimsDecode: true })).toBe("active");
  });

  it("encode✗ decode✓ → inactive", () => {
    expect(deriveAddressState({ allDimsEncode: false, allDimsDecode: true })).toBe("inactive");
  });

  it("encode✓ decode✗ → open", () => {
    expect(deriveAddressState({ allDimsEncode: true, allDimsDecode: false })).toBe("open");
  });

  it("encode✗ decode✗ → reserved", () => {
    expect(deriveAddressState({ allDimsEncode: false, allDimsDecode: false })).toBe("reserved");
  });
});

describe("deriveServiceStatus", () => {
  it("catalog에 없음 → retired", () => {
    expect(deriveServiceStatus({ existsInCatalog: false, hasOwnedPrefixes: false, isDeprecated: false }))
      .toBe("retired");
  });

  it("deprecated → deprecated", () => {
    expect(deriveServiceStatus({ existsInCatalog: true, hasOwnedPrefixes: true, isDeprecated: true }))
      .toBe("deprecated");
  });

  it("활성 → active", () => {
    expect(deriveServiceStatus({ existsInCatalog: true, hasOwnedPrefixes: true, isDeprecated: false }))
      .toBe("active");
  });
});

describe("deriveEventStatus", () => {
  it("registry에서 제거 → retired", () => {
    expect(deriveEventStatus({ isActive: null, isDeprecated: false })).toBe("retired");
  });

  it("deprecated → deprecated", () => {
    expect(deriveEventStatus({ isActive: true, isDeprecated: true })).toBe("deprecated");
  });

  it("활성 → active", () => {
    expect(deriveEventStatus({ isActive: true, isDeprecated: false })).toBe("active");
  });
});

describe("deriveMetricHealth", () => {
  it("null 입력 → ok", () => {
    expect(deriveMetricHealth(null)).toBe("ok");
  });

  it("빈 값 → ok", () => {
    expect(deriveMetricHealth({ values: [], warningThreshold: 80, criticalThreshold: 95 })).toBe("ok");
  });

  it("임계값 이내 → ok", () => {
    expect(deriveMetricHealth({ values: [50, 60, 70], warningThreshold: 80, criticalThreshold: 95 })).toBe("ok");
  });

  it("warning 임계값 초과 → warning", () => {
    expect(deriveMetricHealth({ values: [50, 85], warningThreshold: 80, criticalThreshold: 95 })).toBe("warning");
  });

  it("critical 임계값 초과 → critical", () => {
    expect(deriveMetricHealth({ values: [50, 96], warningThreshold: 80, criticalThreshold: 95 })).toBe("critical");
  });
});

// ═══════════════════════════════════════════════════════════════
// 오케스트레이터
// ═══════════════════════════════════════════════════════════════

describe("deriveAllStates", () => {
  it("문서 머신 4개는 항상 파생", () => {
    const result = deriveAllStates({
      docId: "test-doc",
      frontmatter: { lifecycle: "approved" },
      sync: { configExists: true, configCount: 10, scanCount: 10, checksumMatch: true },
      specImpl: { hasSvc: true, hasCode: true, hasTests: true, testsPass: true, isSourceReferenced: false },
      convention: { evidenceCount: 10, coverage: 100, hasFailures: false },
      versionStatus: null,
      flowStatus: null,
      policyStatus: null,
      address: null,
      service: null,
      event: null,
      metric: null,
    });

    expect(result["doc-lifecycle"]).toBe("approved");
    expect(result["spec-impl"]).toBe("verified");
    expect(result["convention-compliance"]).toBe("compliant");
    expect(result["db-sync"]).toBe("synced");
  });

  it("null 입력인 시스템 머신은 결과에 포함되지 않음", () => {
    const result = deriveAllStates({
      docId: "test-doc",
      frontmatter: { lifecycle: "draft" },
      sync: { configExists: false, configCount: 0, scanCount: 5, checksumMatch: false },
      specImpl: { hasSvc: false, hasCode: false, hasTests: false, testsPass: null, isSourceReferenced: false },
      convention: { evidenceCount: 0, coverage: 0, hasFailures: false },
      versionStatus: null,
      flowStatus: null,
      policyStatus: null,
      address: null,
      service: null,
      event: null,
      metric: null,
    });

    expect(result["address-state"]).toBeUndefined();
    expect(result["service-status"]).toBeUndefined();
    expect(result["event-status"]).toBeUndefined();
  });

  it("시스템 머신 입력 제공 시 파생됨", () => {
    const result = deriveAllStates({
      docId: "test-doc",
      frontmatter: { lifecycle: "approved" },
      sync: { configExists: true, configCount: 1, scanCount: 1, checksumMatch: true },
      specImpl: { hasSvc: false, hasCode: false, hasTests: false, testsPass: null, isSourceReferenced: false },
      convention: { evidenceCount: 0, coverage: 0, hasFailures: false },
      versionStatus: "active",
      flowStatus: "completed",
      policyStatus: "approved",
      address: { allDimsEncode: true, allDimsDecode: true },
      service: { existsInCatalog: true, hasOwnedPrefixes: true, isDeprecated: false },
      event: { isActive: true, isDeprecated: false },
      metric: { values: [50], warningThreshold: 80, criticalThreshold: 95 },
    });

    expect(result["version-lifecycle"]).toBe("active");
    expect(result["decision-flow"]).toBe("completed");
    expect(result["policy-candidate"]).toBe("approved");
    expect(result["address-state"]).toBe("active");
    expect(result["service-status"]).toBe("active");
    expect(result["event-status"]).toBe("active");
    expect(result["metric-health"]).toBe("ok");
  });

  it("Group C null은 미연결 — 결과에서 제외 (version, flow, policy, metric)", () => {
    const result = deriveAllStates({
      docId: "test-doc",
      frontmatter: { lifecycle: "draft" },
      sync: { configExists: false, configCount: 0, scanCount: 0, checksumMatch: false },
      specImpl: { hasSvc: false, hasCode: false, hasTests: false, testsPass: null, isSourceReferenced: false },
      convention: { evidenceCount: 0, coverage: 0, hasFailures: false },
      versionStatus: null,
      flowStatus: null,
      policyStatus: null,
      address: null,
      service: null,
      event: null,
      metric: null,
    });

    // Group C: null → 미연결 → 키 자체가 없어야 함
    expect(result["version-lifecycle"]).toBeUndefined();
    expect(result["decision-flow"]).toBeUndefined();
    expect(result["policy-candidate"]).toBeUndefined();
    expect(result["metric-health"]).toBeUndefined();

    // Group D: null → 미연결 → 키 자체가 없어야 함
    expect(result["address-state"]).toBeUndefined();
    expect(result["service-status"]).toBeUndefined();
    expect(result["event-status"]).toBeUndefined();
  });
});
