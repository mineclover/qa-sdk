// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 게이트 트래커 — 품질 게이트 FSM 전이를 SDK 이벤트로 수집.
 *
 * work-domain의 순수 함수(transitionGate, deriveBundleState)를 래핑하여
 * gate.execution / bundle.observation 이벤트를 자동 emit한다.
 *
 * 사용법:
 *   const tracker = createGateTracker({ logger, plan });
 *   tracker.applyEvent(0, { type: "schedule" });
 *   // → gate.execution 이벤트 emit + bundle.observation 자동 emit
 */

import type {
  GateEvent,
  GateState,
  BundleState,
  HarnessPlan,
  HarnessInstance,
  GateRequirement,
} from './harness.js';
import {
  transitionGate,
  deriveBundleState,
  createHarnessInstance,
  nextReadyGates,
} from './harness.js';

// ─── 로거 인터페이스 (SDK 의존 없음) ──────────────────

/** definition-catalog의 HarnessLogger와 동일 형태 */
export interface GateLogger {
  log(params: {
    event_key: string;
    event_version: string;
    payload?: Record<string, unknown>;
    address_context?: Record<string, string>;
  }): void;
}

// ─── 트래커 설정 ──────────────────────────────────────

/**
 * 번들 상태 변경 리스너.
 * 외부 시스템(harness-tracker 등)이 구현하여 Gate→Harness 루프를 연결한다.
 */
export interface BundleStateListener {
  /** 번들 상태가 변경될 때 호출 */
  onBundleStateChanged(anchorId: string, prevState: BundleState, newState: BundleState): void;
}

export interface GateTrackerConfig {
  /** SDK 로거 인스턴스 */
  readonly logger: GateLogger;
  /** 하네스 계획 (buildHarnessPlan으로 생성) */
  readonly plan: HarnessPlan;
  /** 번들 상태 변경 리스너 (Cross-Loop 연결용) */
  readonly listener?: BundleStateListener;
}

export interface GateTracker {
  /** 특정 gate에 이벤트 적용 — 상태 전이 + emit */
  applyEvent(gateIndex: number, event: GateEvent): void;
  /** 현재 하네스 인스턴스 조회 */
  getInstance(): HarnessInstance;
  /** 실행 가능한 다음 gate 인덱스 */
  getReadyGates(): number[];
  /** 특정 gate의 현재 상태 */
  getGateState(gateIndex: number): GateState | undefined;
  /** 현재 번들 상태 */
  getBundleState(): BundleState;
}

// ─── 트래커 구현 ──────────────────────────────────────

export function createGateTracker(config: GateTrackerConfig): GateTracker {
  const { logger, plan, listener } = config;
  let instance = createHarnessInstance(plan);

  function emitGateExecution(req: GateRequirement, fromState: GateState, toState: GateState): void {
    logger.log({
      event_key: 'gate.execution',
      event_version: '1',
      payload: {
        anchor_id: plan.anchorId,
        contract_doc_id: req.contractDocId,
        gate_kind: req.gateKind,
        gate_scope: req.gateScope,
        from_state: fromState,
        to_state: toState,
        timestamp: new Date().toISOString(),
      },
      address_context: {
        gate_execution: `gate_execution:v1:${req.gateKind}:${req.gateScope}:${toState}`,
      },
    });
  }

  function emitBundleObservation(prevState: BundleState, newState: BundleState): void {
    logger.log({
      event_key: 'bundle.observation',
      event_version: '1',
      payload: {
        anchor_id: plan.anchorId,
        from_state: prevState,
        bundle_state: newState,
        total_gates: instance.gates.length,
        passed: instance.gates.filter((g) => g.state === 'passed').length,
        failed: instance.gates.filter((g) => g.state === 'failed').length,
        timestamp: new Date().toISOString(),
      },
      address_context: {
        bundle_observation: `bundle_observation:v1:${newState}`,
      },
    });
  }

  return {
    applyEvent(gateIndex: number, event: GateEvent): void {
      const gate = instance.gates[gateIndex];
      if (!gate) return;

      const fromGateState = gate.state;
      const prevBundleState = instance.bundleState;

      // 게이트 전이
      const newGateState = transitionGate(fromGateState, event);
      if (newGateState === fromGateState) return; // 무효 전이

      // 인스턴스 갱신 (immutable → 새 인스턴스)
      const gates = instance.gates.map((g, i) => {
        if (i !== gateIndex) return g;
        return {
          ...g,
          state: newGateState,
          lastExitCode: event.type === 'exit' ? event.code : g.lastExitCode,
          lastTransitionAt: new Date().toISOString(),
        };
      });
      const newBundleState = deriveBundleState(gates.map((g) => g.state));
      instance = { ...instance, gates, bundleState: newBundleState };

      // gate 전이 emit
      emitGateExecution(gate.requirement, fromGateState, newGateState);

      // 번들 상태 변경 시 emit + listener 호출
      if (newBundleState !== prevBundleState) {
        emitBundleObservation(prevBundleState, newBundleState);
        listener?.onBundleStateChanged(plan.anchorId, prevBundleState, newBundleState);
      }
    },

    getInstance(): HarnessInstance {
      return instance;
    },

    getReadyGates(): number[] {
      return nextReadyGates(instance);
    },

    getGateState(gateIndex: number): GateState | undefined {
      return instance.gates[gateIndex]?.state;
    },

    getBundleState(): BundleState {
      return instance.bundleState;
    },
  };
}
