/**
 * Cross-Loop 브릿지 — 6개 피드백 루프 간 연결 조직.
 *
 * 각 루프는 독립적으로 동작하지만, 루프 간 연결이 없으면
 * 시스템 전체의 피드백이 끊어진다. 이 모듈이 그 연결 조직.
 *
 * 연결:
 *   ③→② Gate complete → Harness convention-compliance 전이
 *   ②→⑤ Harness 상태 → Decision 컨텍스트 enrichment
 *   ⑤→⑥ Decision verdict → Definition lifecycle 제안
 */

import type { HarnessTracker } from "./harness-tracker.js";
import type { DefinitionEntry } from "./types.js";
import { suggestLifecycleFromVerdict, buildDefinitionContext } from "./bridge.js";

// ═══════════════════════════════════════════════════════════════
// ③→② Gate → Harness Bridge
// ═══════════════════════════════════════════════════════════════

/**
 * BundleStateListener 구현.
 *
 * gate-tracker의 BundleState가 "complete"가 되면
 * harness-tracker의 해당 엔티티에 convention-compliance → compliant 전이를 시도한다.
 *
 * 이것은 "품질 게이트가 모두 통과했으므로 컨벤션 준수 상태로 전이"라는
 * 시스템 레벨의 자동 판단이다.
 */
export interface GateHarnessBridgeConfig {
  readonly harnessTracker: HarnessTracker;
  /** 로거 (경고용, optional) */
  readonly logger?: { warn(params: { err?: unknown }, msg: string): void };
}

export interface GateHarnessBridge {
  /** BundleStateListener.onBundleStateChanged 구현 */
  onBundleStateChanged(anchorId: string, prevState: string, newState: string): void;
}

export function createGateHarnessBridge(config: GateHarnessBridgeConfig): GateHarnessBridge {
  const { harnessTracker, logger } = config;

  return {
    onBundleStateChanged(anchorId: string, _prevState: string, newState: string): void {
      if (newState !== "complete") return;

      // 게이트 전체 통과 → convention-compliance를 compliant로 전이
      try {
        harnessTracker.transition(
          "convention-compliance",
          anchorId,
          "compliant",
          "cascade",
        );
      } catch (err) {
        // 이미 compliant이거나 전이 불가 — 무시하되 경고
        logger?.warn({ err }, `Gate→Harness bridge: ${anchorId} convention 전이 실패`);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ②→⑤ Harness → Decision Context Enrichment
// ═══════════════════════════════════════════════════════════════

/**
 * 하네스 머신 상태를 DecisionContext에 주입할 수 있는 형태로 변환한다.
 *
 * ContextProvider.provide(schemaId, context)의 context에
 * 하네스 상태를 추가하면, 의사결정 시 시스템의 현재 상태를 참고할 수 있다.
 */
export interface HarnessContextSnapshot {
  /** 머신별 현재 상태 */
  readonly machineStates: Readonly<Record<string, string>>;
  /** 전체적 상태 요약 (가장 심각한 상�� 기준) */
  readonly overallHealth: "healthy" | "warning" | "critical";
  /** 경고 목록 */
  readonly warnings: readonly string[];
}

export function buildHarnessContext(
  harnessTracker: HarnessTracker,
  entityId: string,
): HarnessContextSnapshot {
  const composite = harnessTracker.getState(entityId);
  if (!composite) {
    return { machineStates: {}, overallHealth: "healthy", warnings: [] };
  }

  const machineStates: Record<string, string> = {};
  const warnings: string[] = [];

  for (const [mid, inst] of composite.states) {
    machineStates[mid] = inst.current;

    // 위험 상태 감지
    if (inst.current === "violated") warnings.push(`${mid}: 컨벤션 위반`);
    if (inst.current === "critical") warnings.push(`${mid}: 메트릭 위험`);
    if (inst.current === "drift-detected") warnings.push(`${mid}: drift 감지`);
    if (inst.current === "blocked") warnings.push(`${mid}: 차단됨`);
  }

  const hasCritical = warnings.some(w => w.includes("위험") || w.includes("위반"));
  const hasWarning = warnings.length > 0;

  return {
    machineStates,
    overallHealth: hasCritical ? "critical" : hasWarning ? "warning" : "healthy",
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════
// ⑤→⑥ Decision → Infrastructure Bridge
// ═══════════════════════════════════════════════════════════════

/**
 * 의사결정 완료 시 정의 체계에 피드백한다.
 *
 * decision-flow의 FlowInstance 완료 → 관련 문서의 lifecycle 전이 제안.
 * 실제 전이는 하네스 트래커를 통해 수행.
 */
export interface DecisionOutcome {
  readonly verdict: "success" | "failure" | "deferred" | "superseded";
  readonly artifactType?: string;
  readonly entityId: string;
}

export interface DecisionInfraBridgeConfig {
  readonly harnessTracker: HarnessTracker;
  readonly logger?: { warn(params: { err?: unknown }, msg: string): void };
}

export interface DecisionInfraBridge {
  /** 의사결정 완료 시 호출 — 문서 lifecycle 전이 제안 */
  onDecisionCompleted(outcome: DecisionOutcome): void;
}

export function createDecisionInfraBridge(config: DecisionInfraBridgeConfig): DecisionInfraBridge {
  const { harnessTracker, logger } = config;

  return {
    onDecisionCompleted(outcome: DecisionOutcome): void {
      const suggestedLifecycle = suggestLifecycleFromVerdict(outcome.verdict);

      try {
        harnessTracker.transition(
          "doc-lifecycle",
          outcome.entityId,
          suggestedLifecycle,
          "system_auto",
        );
      } catch (err) {
        // 전이 불가 (현재 상태에서 해당 lifecycle로 전이 규칙 없음) — 경고만
        logger?.warn({ err }, `Decision→Infra bridge: ${outcome.entityId} → ${suggestedLifecycle} 전이 실패`);
      }
    },
  };
}
