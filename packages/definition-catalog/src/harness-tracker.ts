// @def.doc definition-harness

/**
 * 하네스 트래커 — 상태 머신 전이를 SDK 이벤트로 수집.
 *
 * 상태 모델(state-model.ts)의 전이 엔진과 SDK 로거를 연결하여
 * 모든 상태 전이를 harness.transition 이벤트로 자동 emit.
 *
 * 사용법:
 *   const tracker = createHarnessTracker({ logger, registry });
 *   tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");
 *   tracker.runProcess("prefix-release", "service:v2");
 */

import type { StateMachineInstance } from './state-model.js';
import { availableTransitions, transition, createInstance } from './state-model.js';
import type {
  HarnessRegistry,
  CompositeInstance,
  TransitionResult,
  ProcessResult,
} from './harness-state-model.js';
import { checkGuards, collectCascades } from './harness-state-model.js';

// ═══════════════════════════════════════════════════════════════
// 로거 인터페이스 — SDK 의존 최소화
// ═══════════════════════════════════════════════════════════════

/**
 * SDK 로거 최소 인터페이스.
 * logger 패키지의 QaLogger와 호환되지만 직접 의존하지 않음.
 */
export interface HarnessLogger {
  log(params: {
    event_key: string;
    event_version: string;
    payload?: Record<string, unknown>;
    address_context?: Record<string, string>;
  }): void;
}

// ═══════════════════════════════════════════════════════════════
// 트래커 설정 + 인스턴스
// ═══════════════════════════════════════════════════════════════

export interface HarnessTrackerConfig {
  /** SDK 로거 인스턴스 */
  readonly logger: HarnessLogger;
  /** 하네스 레지스트리 (머신 + 의존 + 프로세스) */
  readonly registry: HarnessRegistry;
  /** 서비스 이름 (address_context 컨텍스트) */
  readonly serviceName?: string;
}

export interface HarnessTracker {
  /** 엔티티에 머신 인스턴스 초기화 */
  init(machineId: string, entityId: string): CompositeInstance;

  /** 단일 전이 실행 + 이벤트 emit */
  transition(
    machineId: string,
    entityId: string,
    targetState: string,
    trigger?: string,
  ): TransitionResult;

  /** 프로세스(복수 머신 전이 시퀀스) 실행 */
  runProcess(processId: string, entityId: string): ProcessResult;

  /** 엔티티의 현재 복합 상태 조회 */
  getState(entityId: string): CompositeInstance | undefined;

  /** 특정 머신에서 가능한 전이 목록 */
  availableTransitions(machineId: string, entityId: string): readonly string[];
}

// ═══════════════════════════════════════════════════════════════
// 트래커 구현
// ═══════════════════════════════════════════════════════════════

export function createHarnessTracker(config: HarnessTrackerConfig): HarnessTracker {
  const { logger, registry } = config;

  // 엔티티별 복합 인스턴스 저장
  const entities = new Map<string, CompositeInstance>();

  function getOrCreateComposite(entityId: string): CompositeInstance {
    let composite = entities.get(entityId);
    if (!composite) {
      composite = {
        entityId,
        entityKind: 'unknown',
        states: new Map(),
      };
      entities.set(entityId, composite);
    }
    return composite;
  }

  function getOrCreateMachineInstance(
    composite: CompositeInstance,
    machineId: string,
  ): StateMachineInstance {
    const states = composite.states as Map<string, StateMachineInstance>;
    let inst = states.get(machineId);
    if (!inst) {
      const machine = registry.machines.get(machineId);
      if (!machine) throw new Error(`머신 미등록: ${machineId}`);
      inst = createInstance(machine, composite.entityId);
      states.set(machineId, inst);
    }
    return inst;
  }

  /** 전이 이벤트 emit */
  function emitTransition(
    machineId: string,
    entityId: string,
    fromState: string,
    toState: string,
    trigger: string,
  ): void {
    logger.log({
      event_key: 'harness.transition',
      event_version: '1',
      payload: {
        machine_id: machineId,
        entity_id: entityId,
        from_state: fromState,
        to_state: toState,
        trigger,
        timestamp: new Date().toISOString(),
      },
      address_context: {
        harness_transition: `harness_transition:v1:${machineId}:${toState}:${trigger}`,
      },
    });
  }

  /** 가드 검증 이벤트 emit */
  function emitGuardCheck(
    machineId: string,
    targetState: string,
    ok: boolean,
    violations: string[],
  ): void {
    const verdict = ok ? 'pass' : 'fail';
    logger.log({
      event_key: 'harness.guard_check',
      event_version: '1',
      payload: {
        target_machine: machineId,
        target_state: targetState,
        ok,
        violations,
      },
      address_context: {
        harness_guard: `harness_guard:v1:${machineId}:${targetState}:${verdict}`,
      },
    });
  }

  /** 프로세스 스텝 이벤트 emit */
  function emitProcessStep(
    processId: string,
    stepIndex: number,
    machineId: string,
    targetState: string,
    success: boolean,
    error?: string,
  ): void {
    const verdict = success ? 'pass' : 'fail';
    logger.log({
      event_key: 'harness.process_step',
      event_version: '1',
      payload: {
        process_id: processId,
        step_index: stepIndex,
        machine_id: machineId,
        target_state: targetState,
        success,
        error,
      },
      address_context: {
        harness_process_step: `harness_process_step:v1:${processId}:${machineId}:${verdict}`,
      },
    });
  }

  return {
    init(machineId: string, entityId: string): CompositeInstance {
      const composite = getOrCreateComposite(entityId);
      getOrCreateMachineInstance(composite, machineId);
      return composite;
    },

    transition(
      machineId: string,
      entityId: string,
      targetState: string,
      trigger = 'system_auto',
    ): TransitionResult {
      const composite = getOrCreateComposite(entityId);
      const machine = registry.machines.get(machineId);
      if (!machine) throw new Error(`머신 미등록: ${machineId}`);

      const inst = getOrCreateMachineInstance(composite, machineId);
      const fromState = inst.current;

      // guard 검증
      const guardResult = checkGuards(registry, composite, machineId, targetState);
      emitGuardCheck(machineId, targetState, guardResult.ok, guardResult.violations);
      if (!guardResult.ok) {
        throw new Error(`가드 위반: ${guardResult.violations.join(', ')}`);
      }

      // 전이 실행
      const updated = transition(machine, inst, targetState);
      (composite.states as Map<string, StateMachineInstance>).set(machineId, updated);

      const primaryRecord = updated.history[updated.history.length - 1];
      emitTransition(machineId, entityId, fromState, targetState, trigger);

      // cascade 수집 + 실행
      const cascades = collectCascades(registry, machineId, targetState);
      const cascadedRecords: (typeof primaryRecord)[] = [];

      for (const dep of cascades) {
        try {
          const cascadeMachine = registry.machines.get(dep.targetMachine);
          if (!cascadeMachine) continue;

          const cascadeInst = getOrCreateMachineInstance(composite, dep.targetMachine);
          const cascadeFrom = cascadeInst.current;

          // cascade 전이가 가능한지 확인
          const rule = cascadeMachine.transitions.find(
            (t: { from: string; to: string }) =>
              t.from === cascadeInst.current && t.to === dep.targetState,
          );
          if (!rule) continue;

          const cascadeUpdated = transition(cascadeMachine, cascadeInst, dep.targetState);
          (composite.states as Map<string, StateMachineInstance>).set(
            dep.targetMachine,
            cascadeUpdated,
          );

          const cascadeRecord = cascadeUpdated.history[cascadeUpdated.history.length - 1];
          cascadedRecords.push(cascadeRecord);
          emitTransition(dep.targetMachine, entityId, cascadeFrom, dep.targetState, 'cascade');
        } catch (err) {
          // cascade 실패는 원본 전이를 차단하지 않음 (fail-open)
          logger.log({
            event_key: 'harness.guard_check',
            event_version: '1',
            payload: {
              target_machine: dep.targetMachine,
              target_state: dep.targetState,
              ok: false,
              violations: [err instanceof Error ? err.message : String(err)],
            },
          });
        }
      }

      // 상태 스냅샷
      const snapshot = new Map<string, string>();
      for (const [mid, minst] of composite.states) {
        snapshot.set(mid, minst.current);
      }

      return { primary: primaryRecord, cascaded: cascadedRecords, snapshot };
    },

    runProcess(processId: string, entityId: string): ProcessResult {
      const process = registry.processes.get(processId);
      if (!process) throw new Error(`프로세스 미등록: ${processId}`);

      const stepResults: (TransitionResult | { error: string })[] = [];
      let failedAt = -1;

      for (let i = 0; i < process.steps.length; i++) {
        const step = process.steps[i];

        try {
          const result = this.transition(step.machineId, entityId, step.targetState, 'system_auto');
          stepResults.push(result);
          emitProcessStep(processId, i, step.machineId, step.targetState, true);
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          stepResults.push({ error: errorMsg });
          emitProcessStep(processId, i, step.machineId, step.targetState, false, errorMsg);
          failedAt = i;
          break;
        }
      }

      return {
        processId,
        entityId,
        completed: failedAt === -1,
        stepResults,
        failedAt,
      };
    },

    getState(entityId: string): CompositeInstance | undefined {
      return entities.get(entityId);
    },

    availableTransitions(machineId: string, entityId: string): readonly string[] {
      const composite = entities.get(entityId);
      if (!composite) return [];

      const machine = registry.machines.get(machineId);
      if (!machine) return [];

      const inst = composite.states.get(machineId);
      if (!inst) return [];

      return availableTransitions(machine, inst.current).map((t) => t.to);
    },
  };
}
