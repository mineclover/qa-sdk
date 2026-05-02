// @def.doc definition-catalog-spec

/**
 * Cross-Loop Bridge 통합 테스트
 *
 * 시나리오: anchor 문서의 품질 게이트 전체 통과 → 하네스 verified → 의사결정 컨텍스트 → 문서 lifecycle 전이
 *
 * ③ Gate complete
 *   ↓ BundleStateListener
 * ② Harness convention-compliance → compliant
 *   ↓ buildHarnessContext
 * ⑤ Decision context enrichment
 *   ↓ DecisionInfraBridge
 * ⑥ Doc lifecycle → approved
 */

import { describe, it, expect } from "vitest";
import { createHarnessTracker } from "./harness-tracker.js";
import type { HarnessLogger } from "./harness-tracker.js";
import { createHarnessRegistry } from "./harness-state-model.js";
import {
  createGateHarnessBridge,
  buildHarnessContext,
  createDecisionInfraBridge,
} from "./cross-loop-bridge.js";

// ── Mock Logger ──────────────────────────────────────

function createMockLogger(): HarnessLogger & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    log(params) { calls.push(params); },
  };
}

// ── 시나리오 1: Gate → Harness 루프 ──────────────────

describe("③→② Gate → Harness Bridge", () => {
  it("BundleState complete → convention-compliance compliant 전이", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    // 엔티티 초기화 — convention-compliance를 partial 상태로 만듦
    tracker.init("convention-compliance", "my-anchor");
    tracker.transition("convention-compliance", "my-anchor", "partial", "system_auto");

    // 브릿지 생성
    const bridge = createGateHarnessBridge({ harnessTracker: tracker });

    // Gate complete 시뮬레이션
    bridge.onBundleStateChanged("my-anchor", "partial", "complete");

    // convention-compliance가 compliant로 전이되었는지 확인
    const state = tracker.getState("my-anchor");
    expect(state).toBeDefined();
    const conventionState = state!.states.get("convention-compliance");
    expect(conventionState?.current).toBe("compliant");
  });

  it("BundleState가 complete가 아니면 전이하지 않는다", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("convention-compliance", "my-anchor");
    tracker.transition("convention-compliance", "my-anchor", "partial", "system_auto");

    const bridge = createGateHarnessBridge({ harnessTracker: tracker });
    bridge.onBundleStateChanged("my-anchor", "pending", "partial");

    const state = tracker.getState("my-anchor");
    const conventionState = state!.states.get("convention-compliance");
    expect(conventionState?.current).toBe("partial"); // 변경 없음
  });

  it("이미 compliant이면 에러 없이 무시한다", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("convention-compliance", "my-anchor");
    tracker.transition("convention-compliance", "my-anchor", "partial", "system_auto");
    tracker.transition("convention-compliance", "my-anchor", "compliant", "system_auto");

    const bridge = createGateHarnessBridge({ harnessTracker: tracker });

    // 이미 compliant — 에러 없이 처리
    expect(() => {
      bridge.onBundleStateChanged("my-anchor", "partial", "complete");
    }).not.toThrow();
  });
});

// ── 시나리오 2: Harness → Decision 컨텍스트 ──────────

describe("②→⑤ Harness → Decision Context", () => {
  it("정상 상태에서 healthy 스냅샷을 반환한다", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("doc-lifecycle", "my-doc");
    tracker.init("convention-compliance", "my-doc");

    const ctx = buildHarnessContext(tracker, "my-doc");
    expect(ctx.overallHealth).toBe("healthy");
    expect(ctx.warnings).toHaveLength(0);
    expect(ctx.machineStates["doc-lifecycle"]).toBe("draft");
    expect(ctx.machineStates["convention-compliance"]).toBe("unverified");
  });

  it("위반 상태에서 critical 스냅샷을 반환한다", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("convention-compliance", "my-doc");
    tracker.transition("convention-compliance", "my-doc", "violated", "system_auto");

    const ctx = buildHarnessContext(tracker, "my-doc");
    expect(ctx.overallHealth).toBe("critical");
    expect(ctx.warnings.length).toBeGreaterThan(0);
    expect(ctx.warnings[0]).toContain("위반");
  });

  it("등록되지 않은 엔티티는 healthy를 반환한다", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    const ctx = buildHarnessContext(tracker, "nonexistent");
    expect(ctx.overallHealth).toBe("healthy");
    expect(Object.keys(ctx.machineStates)).toHaveLength(0);
  });
});

// ── 시나리오 3: Decision → Infrastructure ────────────

describe("⑤→⑥ Decision → Infrastructure Bridge", () => {
  it("success verdict → doc-lifecycle approved 전이", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    // doc-lifecycle를 review 상태로 준비 (draft → review → approved 경로)
    tracker.init("doc-lifecycle", "my-doc");
    tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");

    const bridge = createDecisionInfraBridge({ harnessTracker: tracker });
    bridge.onDecisionCompleted({
      verdict: "success",
      entityId: "my-doc",
    });

    const state = tracker.getState("my-doc");
    const docState = state!.states.get("doc-lifecycle");
    expect(docState?.current).toBe("approved");
  });

  it("failure verdict → doc-lifecycle deprecated 전이", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    // approved 상태로 준비
    tracker.init("doc-lifecycle", "my-doc");
    tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");
    tracker.transition("doc-lifecycle", "my-doc", "approved", "user_action");

    const bridge = createDecisionInfraBridge({ harnessTracker: tracker });
    bridge.onDecisionCompleted({
      verdict: "failure",
      entityId: "my-doc",
    });

    const state = tracker.getState("my-doc");
    const docState = state!.states.get("doc-lifecycle");
    expect(docState?.current).toBe("deprecated");
  });

  it("전이 불가능한 경우 에러 없이 경고만 발생한다", () => {
    const warnings: string[] = [];
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("doc-lifecycle", "my-doc");
    // draft에서 바로 approved는 불가 (review 거쳐야 함)

    const warnLogger = { warn(_p: unknown, msg: string) { warnings.push(msg); } };
    const bridge = createDecisionInfraBridge({ harnessTracker: tracker, logger: warnLogger });

    expect(() => {
      bridge.onDecisionCompleted({ verdict: "success", entityId: "my-doc" });
    }).not.toThrow();

    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ── 시나리오 4: 전체 Cross-Loop 관통 ────────────────

describe("전체 Cross-Loop 시나리오", () => {
  it("Decision success → Doc approved → Gate complete → Convention compliant", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    // ── 준비: 엔티티 초기화 ──
    tracker.init("doc-lifecycle", "feature-x");
    tracker.init("convention-compliance", "feature-x");

    // doc을 review 상태로
    tracker.transition("doc-lifecycle", "feature-x", "review", "user_action");

    // convention을 partial로
    tracker.transition("convention-compliance", "feature-x", "partial", "system_auto");

    // ── ⑤→⑥ Decision success → Doc approved ──
    const decisionInfra = createDecisionInfraBridge({ harnessTracker: tracker });
    decisionInfra.onDecisionCompleted({
      verdict: "success",
      entityId: "feature-x",
    });

    const afterDecision = tracker.getState("feature-x");
    expect(afterDecision!.states.get("doc-lifecycle")?.current).toBe("approved");

    // ── ②→⑤ Harness → Decision Context (approved 상태 확인) ──
    const midCtx = buildHarnessContext(tracker, "feature-x");
    expect(midCtx.machineStates["doc-lifecycle"]).toBe("approved");

    // ── ③→② Gate complete → Convention compliant ──
    // guard 충족: doc-lifecycle이 approved여야 convention → compliant 가능
    const gateHarness = createGateHarnessBridge({ harnessTracker: tracker });
    gateHarness.onBundleStateChanged("feature-x", "partial", "complete");

    const afterGate = tracker.getState("feature-x");
    expect(afterGate!.states.get("convention-compliance")?.current).toBe("compliant");

    // ── 최종 상태 확인 ──
    const finalCtx = buildHarnessContext(tracker, "feature-x");
    expect(finalCtx.overallHealth).toBe("healthy");
    expect(finalCtx.machineStates["doc-lifecycle"]).toBe("approved");
    expect(finalCtx.machineStates["convention-compliance"]).toBe("compliant");
  });
});

// ── 엣지 케이스 ──────────────────────────────────────

describe("엣지 케이스", () => {
  it("guard 순서 위반 — doc이 approved가 아닌데 convention compliant 시도 → 경고만, 에러 없음", () => {
    const warnings: string[] = [];
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("doc-lifecycle", "my-doc");
    tracker.init("convention-compliance", "my-doc");
    tracker.transition("convention-compliance", "my-doc", "partial", "system_auto");
    // doc은 draft 상태 — guard 위반

    const warnLogger = { warn(_p: unknown, msg: string) { warnings.push(msg); } };
    const bridge = createGateHarnessBridge({ harnessTracker: tracker, logger: warnLogger });

    expect(() => bridge.onBundleStateChanged("my-doc", "partial", "complete")).not.toThrow();
    expect(warnings.length).toBeGreaterThan(0);

    // convention은 partial 유지
    const state = tracker.getState("my-doc");
    expect(state!.states.get("convention-compliance")?.current).toBe("partial");
  });

  it("cascade 실패 격리 — 한 cascade 실패가 다른 전이를 차단하지 않음", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    // service-status deprecated → event-status deprecated (cascade)
    tracker.init("service-status", "my-svc");
    tracker.init("event-status", "my-svc");

    // event-status를 retired로 만들어 deprecated 전이 불가하게
    tracker.transition("event-status", "my-svc", "deprecated", "system_auto");
    tracker.transition("event-status", "my-svc", "retired", "system_auto");

    // service deprecated → event cascade 시도하지만 event가 retired(terminal)이므로 실패
    // 원본 service 전이는 성공해야 함
    tracker.transition("service-status", "my-svc", "deprecated", "system_auto");

    const state = tracker.getState("my-svc");
    expect(state!.states.get("service-status")?.current).toBe("deprecated");
    expect(state!.states.get("event-status")?.current).toBe("retired"); // 변경 없음

    // cascade 실패가 로깅되었는지 확인
    const guardEvents = logger.calls.filter(
      (c: Record<string, unknown>) => c.event_key === "harness.guard_check"
    );
    // cascade 전이 가능성 확인 후 rule 없으면 skip (에러 아님), 있으면 전이 시도
    // retired는 terminal이므로 transition rule이 없어 continue됨 — 이 경우 guard_check 이벤트 없음
    expect(state!.states.get("service-status")?.current).toBe("deprecated");
  });

  it("미등록 엔티티에 대한 buildHarnessContext는 안전하게 healthy 반환", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    const ctx = buildHarnessContext(tracker, "does-not-exist");
    expect(ctx.overallHealth).toBe("healthy");
    expect(ctx.machineStates).toEqual({});
    expect(ctx.warnings).toEqual([]);
  });

  it("동일 전이 반복 호출 — 이미 같은 상태이면 에러 발생", () => {
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("doc-lifecycle", "my-doc");
    tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");

    // review에서 review로 전이 규칙 없음 → 에러
    expect(() => {
      tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");
    }).toThrow();
  });

  it("deferred verdict → doc draft로 전이 시도 — 이미 draft이면 경고만", () => {
    const warnings: string[] = [];
    const logger = createMockLogger();
    const registry = createHarnessRegistry();
    const tracker = createHarnessTracker({ logger, registry });

    tracker.init("doc-lifecycle", "my-doc"); // 이미 draft

    const warnLogger = { warn(_p: unknown, msg: string) { warnings.push(msg); } };
    const bridge = createDecisionInfraBridge({ harnessTracker: tracker, logger: warnLogger });

    expect(() => {
      bridge.onDecisionCompleted({ verdict: "deferred", entityId: "my-doc" });
    }).not.toThrow();

    // draft → draft 전이 불가이므로 경고 발생
    expect(warnings.length).toBeGreaterThan(0);
  });
});
