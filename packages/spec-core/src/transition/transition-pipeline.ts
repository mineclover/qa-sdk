// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Pipeline — convergence pipeline에 주입되는 전이 함수 번들.
 *
 * PatternFunctions와 대칭 구조.
 * 세션 단위 처리: 세션마다 fresh engine (상태 격리).
 */

import type { Catalog } from "@qa-sdk/core";
import type { TransitionSpec, TransitionInstance } from "spec-transition";
import type { TransitionEvent } from "spec-transition";
import type { InputViolation } from "spec-transition";
import type { ObservationNode } from "dkg";
import { TransitionRegistry } from "spec-transition";
import { InMemoryStateStore } from "spec-transition";
import { TransitionEngine } from "spec-transition";
import { violationsToObservations } from "dkg";
import { decodeAddressContext } from "spec-transition";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface TransitionSessionInput {
  readonly sessionId: string;
  /** 디코딩된 address_context를 가진 이벤트 */
  readonly events: readonly TransitionEvent[];
}

export interface TransitionSessionResult {
  readonly sessionId: string;
  readonly instances: readonly TransitionInstance[];
  readonly violations: readonly InputViolation[];
  readonly unmatchedCount: number;
}

/** tier-3 수렴 metric 3종의 입력 */
export interface TransitionFlushResult {
  readonly sessionsProcessed: number;
  readonly transitionsDetected: number;
  readonly violationsDetected: number;
  /** transition_coverage: 매칭된 spec 수 / 전체 spec 수 */
  readonly coverageRate: number;
  /** input_violation_rate: 위반 수 / (위반 + 성공) */
  readonly violationRate: number;
  /** orphan_sequence: unmatched 이벤트가 있는 세션 수 */
  readonly orphanSequences: number;
}

/** Phase 2.5 + convergence pipeline에 주입되는 전이 함수 번들 */
export interface TransitionFunctions {
  processSession: (input: TransitionSessionInput) => TransitionSessionResult;
  violationsToObs: (violations: readonly InputViolation[], opts?: { date?: string }) => ObservationNode[];
  /** 인코딩된 address_context → 디코딩된 축:entry flat map */
  decodeCtx: (catalog: Catalog, encoded: Record<string, string>) => Record<string, string>;
  specs: readonly TransitionSpec[];
}

// ═══════════════════════════════════════════════════════════════
//  Factory
// ═══════════════════════════════════════════════════════════════

/**
 * TransitionFunctions 팩토리.
 *
 * 세션마다 fresh InMemoryStateStore를 생성하여 상태 격리.
 * registry는 공유 (spec 정의는 불변).
 */
export function createTransitionFunctions(
  specs: readonly TransitionSpec[],
): TransitionFunctions {
  const registry = new TransitionRegistry();
  for (const spec of specs) {
    registry.register(spec);
  }

  function processSession(input: TransitionSessionInput): TransitionSessionResult {
    // 세션마다 fresh store — 상태 격리
    const store = new InMemoryStateStore();
    const engine = new TransitionEngine(registry, store);

    const result = engine.process(input.events);

    return {
      sessionId: input.sessionId,
      instances: result.instances,
      violations: result.violations,
      unmatchedCount: result.unmatched_events.length,
    };
  }

  return {
    processSession,
    violationsToObs: violationsToObservations,
    decodeCtx: decodeAddressContext,
    specs,
  };
}
