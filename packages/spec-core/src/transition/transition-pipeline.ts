/**
 * Transition Pipeline — convergence pipeline에 주입되는 전이 함수 번들.
 *
 * PatternFunctions와 대칭 구조.
 * 세션 단위 처리: 세션마다 fresh engine (상태 격리).
 */

import type { TransitionSpec, TransitionInstance } from "./transition.types.js";
import type { TransitionEvent } from "./transition-engine.js";
import type { InputViolation } from "./input-validator.js";
import type { ObservationNode } from "../dkg/dkg.types.js";
import { TransitionRegistry } from "./transition.registry.js";
import { InMemoryStateStore } from "./state-store.js";
import { TransitionEngine } from "./transition-engine.js";
import { violationsToObservations } from "./violation-bridge.js";

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

export interface TransitionFlushResult {
  readonly sessionsProcessed: number;
  readonly transitionsDetected: number;
  readonly violationsDetected: number;
}

/** convergence pipeline에 주입되는 전이 함수 번들 */
export interface TransitionFunctions {
  processSession: (input: TransitionSessionInput) => TransitionSessionResult;
  violationsToObs: (violations: readonly InputViolation[], opts?: { date?: string }) => ObservationNode[];
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
    specs,
  };
}
