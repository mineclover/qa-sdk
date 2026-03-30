/**
 * Definition Runtime — 좌표 체계 전체 초기화 진입점.
 *
 * 하네스 트래커, 게이트 트래커, Cross-Loop 브릿지를 하나의 호출로 초기화한다.
 * 서비스/CLI가 이 함수를 호출하면 6개 피드백 루프가 연결된다.
 *
 * 사용법:
 *   const runtime = createDefinitionRuntime({ logger });
 *
 *   // 상태 전이
 *   runtime.harness.transition("doc-lifecycle", "my-doc", "review", "user_action");
 *
 *   // 품질 게이트 실행
 *   const gate = runtime.createGateSession("my-anchor", docGraph);
 *   gate.applyEvent(0, { type: "schedule" });
 *   // → gate complete 시 자동으로 harness convention-compliance → compliant
 *
 *   // 의사결정 피드백
 *   runtime.onDecisionCompleted({ verdict: "success", entityId: "my-doc" });
 *   // → doc-lifecycle → approved 자동 전이
 *
 *   // 컨텍스트 조회
 *   const ctx = runtime.getHarnessContext("my-doc");
 *   // → { overallHealth: "healthy", machineStates: {...}, warnings: [] }
 */

import { createHarnessRegistry } from "./harness-state-model.js";
import { createHarnessTracker } from "./harness-tracker.js";
import type { HarnessTracker, HarnessLogger } from "./harness-tracker.js";
import type { HarnessRegistry } from "./harness-state-model.js";
import {
  createGateHarnessBridge,
  buildHarnessContext,
  createDecisionInfraBridge,
} from "./cross-loop-bridge.js";
import type {
  GateHarnessBridge,
  HarnessContextSnapshot,
  DecisionOutcome,
  DecisionInfraBridge,
} from "./cross-loop-bridge.js";

// ─── 설정 ──────────────────────────────────────────────

export interface DefinitionRuntimeConfig {
  /** SDK 로거 (이벤트 emit용) */
  readonly logger: HarnessLogger;
  /** 서비스 이름 (address_context 컨텍스트용, optional) */
  readonly serviceName?: string;
  /** 경고 로거 (bridge 실패 시, optional) */
  readonly warnLogger?: { warn(params: { err?: unknown }, msg: string): void };
}

// ─── 런타임 인터페이스 ──────────────────────────────────

export interface DefinitionRuntime {
  /** 하네스 트래커 — 11개 머신 상태 관리 */
  readonly harness: HarnessTracker;
  /** 하네스 레지스트리 — 머신/의존/프로세스 정의 */
  readonly registry: HarnessRegistry;
  /** Gate → Harness 브릿지 (BundleStateListener 구현) */
  readonly gateHarnessBridge: GateHarnessBridge;
  /** Decision → Infrastructure 브릿지 */
  readonly decisionInfraBridge: DecisionInfraBridge;

  /** 의사결정 완료 피드백 (suggestLifecycleFromVerdict → doc-lifecycle 전이) */
  onDecisionCompleted(outcome: DecisionOutcome): void;

  /** 하네스 컨텍스트 스냅샷 (ContextProvider에 주입용) */
  getHarnessContext(entityId: string): HarnessContextSnapshot;

  /**
   * 품질 게이트 세션 생성.
   *
   * work-domain의 buildHarnessPlan + createGateTracker를 호출하고,
   * listener에 gateHarnessBridge를 자동 연결한다.
   *
   * 반환: gate-tracker의 import를 소비자에게 위임 (순환 의존 방지)
   */
  readonly gateListener: GateHarnessBridge;
}

// ─── 런타임 생성 ────────────────────────────────────────

/**
 * 좌표 체계 전체를 초기화한다.
 *
 * 1호출로 6개 피드백 루프의 모든 브릿지가 연결된다:
 *   ③→② Gate → Harness (gateHarnessBridge)
 *   ②→⑤ Harness → Decision (getHarnessContext)
 *   ⑤→⑥ Decision → Infrastructure (onDecisionCompleted)
 */
export function createDefinitionRuntime(config: DefinitionRuntimeConfig): DefinitionRuntime {
  const { logger, warnLogger } = config;

  // 11개 머신 레지스트리 초기화
  const registry = createHarnessRegistry();

  // 하네스 트래커 초기화
  const harness = createHarnessTracker({
    logger,
    registry,
    serviceName: config.serviceName,
  });

  // Cross-Loop 브릿지 초기화
  const gateHarnessBridge = createGateHarnessBridge({
    harnessTracker: harness,
    logger: warnLogger,
  });

  const decisionInfraBridge = createDecisionInfraBridge({
    harnessTracker: harness,
    logger: warnLogger,
  });

  return {
    harness,
    registry,
    gateHarnessBridge,
    decisionInfraBridge,
    gateListener: gateHarnessBridge,

    onDecisionCompleted(outcome: DecisionOutcome): void {
      decisionInfraBridge.onDecisionCompleted(outcome);
    },

    getHarnessContext(entityId: string): HarnessContextSnapshot {
      return buildHarnessContext(harness, entityId);
    },
  };
}
