/**
 * 하네스 상태 모델 — 시스템 전체 개념을 유한 상태로 통합 관리.
 *
 * 기존 state-model.ts의 FSM 엔진 위에:
 *   1. 시스템의 모든 개념을 상태 머신으로 선언
 *   2. 머신 간 의존 관계(cascade, guard)를 선언적 표현
 *   3. 프로세스(복수 머신 전이 시퀀스)�� 일반화
 *
 * 설계 원칙:
 *   - 상태 = 개념이 가질 수 있는 유한한 모드
 *   - 전이 = 상태 간 허용된 변경 + 조건(guard)
 *   - 의존 = 머신 A의 전이가 머신 B에 미치는 영향
 *   - 프로세스 = 복수 머신의 전이 시퀀스 (파이프라인)
 */

import type {
  StateMachineDefinition,
  TransitionRule,
  StateMachineInstance,
  StateTransitionRecord,
} from "./state-model.js";
import { createInstance } from "./state-model.js";

// ── 머신 선언 (harness-machines.ts에서 추출) — import + re-export ──
import {
  ADDRESS_STATE_MACHINE, VERSION_LIFECYCLE_MACHINE, FLOW_STATE_MACHINE,
  SERVICE_STATE_MACHINE, EVENT_STATE_MACHINE, METRIC_HEALTH_MACHINE, POLICY_STATE_MACHINE,
} from "./harness-machines.js";
export type { AddressState, VersionLifecycleState, FlowState, ServiceState, EventState, MetricHealthState, PolicyState } from "./harness-machines.js";
export {
  ADDRESS_STATE_MACHINE, VERSION_LIFECYCLE_MACHINE, FLOW_STATE_MACHINE,
  SERVICE_STATE_MACHINE, EVENT_STATE_MACHINE, METRIC_HEALTH_MACHINE, POLICY_STATE_MACHINE,
};

// ── guard/cascade (harness-guards.ts에서 추출) — re-export ──
export { checkGuards, collectCascades } from "./harness-guards.js";

// ═══════════════════════════════════════════════════════════════
// 1. 머신 간 의�� 관계
// ═══════════════════════════════════════════════════════════════

/**
 * 머신 간 의존 — A 머신의 전이가 B 머신에 영향을 미침.
 *
 * cascade: A가 전이하면 B도 자동 전이 (도미노)
 * guard:   A가 특정 상태여야 B의 전이가 허용됨 (전제 조건)
 * notify:  A가 전이하면 B에 이벤트 전달 (관찰)
 */
export type DependencyKind = "cascade" | "guard" | "notify";

export interface MachineDependency {
  /** 의존 유형 */
  readonly kind: DependencyKind;
  /** 원본 머신 ID */
  readonly sourceMachine: string;
  /** 원본 상태 (이 상태에 진입했을 때 발동) */
  readonly sourceState: string;
  /** 대상 머신 ID */
  readonly targetMachine: string;
  /** cascade: 자동 전이할 상태, guard: 요구되는 상태, notify: 전달할 이벤트 이름 */
  readonly targetState: string;
  /** 부가 설명 */
  readonly label: string;
}

// ═══════════════════════════════════════════════════════════════
// 2. 프로세스 — 복수 머신 전이 시퀀스
// ═══════════════════════════════════════════════════════════════

/**
 * 프로세스 스텝 — 하나의 머신에서 하나의 전이.
 */
export interface ProcessStep {
  /** 대상 머신 ID */
  readonly machineId: string;
  /** 전이할 목표 상태 */
  readonly targetState: string;
  /** 스텝 설명 */
  readonly label: string;
  /** 선행 조건 — 이 스텝 전에 다른 머신이 특정 상태여야 함 */
  readonly preconditions?: readonly { machineId: string; requiredState: string }[];
  /** 실패 시 롤백할 이전 스텝 인덱스 (-1이면 롤백 없음) */
  readonly rollbackTo?: number;
}

/**
 * 프로세스 — 명명된 전이 시퀀스.
 *
 * 예: "prefix 릴리스" = [version:draft→released, gate:open→active, doc:draft→approved]
 */
export interface ProcessDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly steps: readonly ProcessStep[];
}

// ═══════════════════════════════════════════════════════════════
// 3. 하네스 레지스트리 — 모든 머신 + 의존 + 프로세스 통합
// ═══════════════════════════════════════════════════════════════

export interface HarnessRegistry {
  readonly machines: ReadonlyMap<string, StateMachineDefinition>;
  readonly dependencies: readonly MachineDependency[];
  readonly processes: ReadonlyMap<string, ProcessDefinition>;
}

// ═══════════════════════════════════════════════════════════════
// 4. 하네스 런타임 — 다중 머신 인스턴스 관리
// ═══════════════════════════════════════════════════════════════

/**
 * 엔티티의 모든 상태를 추적하는 복합 인스턴스.
 *
 * 하나의 엔티티(예: prefix "service:v2")가 여러 머신의 인스턴스�� 동시에 가질 수 있음:
 *   - version-lifecycle: active
 *   - gate-state: active
 *   - convention: compliant
 */
export interface CompositeInstance {
  readonly entityId: string;
  readonly entityKind: string;
  readonly states: ReadonlyMap<string, StateMachineInstance>;
}

/**
 * 전이 결과 — 단일 전이 + cascade 전이 포함.
 */
export interface TransitionResult {
  /** 직접 전이 기록 */
  readonly primary: StateTransitionRecord;
  /** cascade로 발생한 연쇄 전��들 */
  readonly cascaded: readonly StateTransitionRecord[];
  /** 전이 후 엔티티의 전체 상태 */
  readonly snapshot: ReadonlyMap<string, string>;
}

/**
 * 프로세스 실행 결과.
 */
export interface ProcessResult {
  readonly processId: string;
  readonly entityId: string;
  readonly completed: boolean;
  /** 각 스텝의 전이 결과 */
  readonly stepResults: readonly (TransitionResult | { error: string })[];
  /** 실패한 스텝 인덱스 (-1이면 전부 성공) */
  readonly failedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// 5. 하네스 엔진 — 레지스트리 기반 전이 실행
// ═══════════════════════════════════════════════════════════════

/**
 * 프로세스 실행 — 스텝 시퀀스를 순서대로 실행.
 *
 * 각 스텝에서:
 *   1. precondition 검증
 *   2. guard 의존성 검증
 *   3. 전이 실행
 *   4. cascade 수집 + 실행
 *   5. 실패 시 rollbackTo까지 역전이 (구현 시 별도)
 */
export function validateProcess(
  registry: HarnessRegistry,
  process: ProcessDefinition,
  composite: CompositeInstance,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const simulatedStates = new Map<string, string>();

  // 현재 상태 스냅샷
  for (const [mid, inst] of composite.states) {
    simulatedStates.set(mid, inst.current);
  }

  for (let i = 0; i < process.steps.length; i++) {
    const step = process.steps[i];
    const machine = registry.machines.get(step.machineId);
    if (!machine) {
      errors.push(`스텝 ${i}: 머신 ${step.machineId} 미등록`);
      continue;
    }

    // precondition 검증
    if (step.preconditions) {
      for (const pre of step.preconditions) {
        const currentState = simulatedStates.get(pre.machineId);
        if (currentState !== pre.requiredState) {
          errors.push(
            `스텝 ${i}: ${pre.machineId}이 ${pre.requiredState}여야 하지만 ${currentState ?? "미초기화"}`,
          );
        }
      }
    }

    // 전이 가능성 검증
    const currentState = simulatedStates.get(step.machineId);
    const rule = machine.transitions.find(
      (t: TransitionRule) => t.from === currentState && t.to === step.targetState,
    );
    if (!rule) {
      errors.push(
        `스텝 ${i}: ${step.machineId}에서 ${currentState} → ${step.targetState} 전이 불가`,
      );
    } else {
      // 시뮬레이션: 상태 업데이트
      simulatedStates.set(step.machineId, step.targetState);
    }
  }

  return { valid: errors.length === 0, errors };
}

// 시스템 머신 선언은 harness-machines.ts에 분리됨


export const SYSTEM_DEPENDENCIES: readonly MachineDependency[] = [
  // version이 deprecated되면 address도 inactive로 전이
  {
    kind: "cascade",
    sourceMachine: "version-lifecycle",
    sourceState: "deprecated",
    targetMachine: "address-state",
    targetState: "inactive",
    label: "버전 폐기 → 주소 비활성화",
  },
  // version이 active여야 address를 active로 만들 수 있음
  {
    kind: "guard",
    sourceMachine: "version-lifecycle",
    sourceState: "active",
    targetMachine: "address-state",
    targetState: "active",
    label: "주소 활성화에는 active 버전 필요",
  },
  // 문서가 approved여야 convention 검증이 의미 있음
  {
    kind: "guard",
    sourceMachine: "doc-lifecycle",
    sourceState: "approved",
    targetMachine: "convention-compliance",
    targetState: "compliant",
    label: "컨벤션 준수는 승인된 문서만",
  },
  // service가 deprecated되면 event도 deprecated
  {
    kind: "cascade",
    sourceMachine: "service-status",
    sourceState: "deprecated",
    targetMachine: "event-status",
    targetState: "deprecated",
    label: "서비스 폐기 → 소유 이벤트 폐기",
  },
  // metric이 critical이면 decision-flow에 notify
  {
    kind: "notify",
    sourceMachine: "metric-health",
    sourceState: "critical",
    targetMachine: "decision-flow",
    targetState: "blocked",
    label: "메트릭 위험 → 의사결정 차단 알림",
  },
  // flow 완료가 doc lifecycle에 notify
  {
    kind: "notify",
    sourceMachine: "decision-flow",
    sourceState: "completed",
    targetMachine: "doc-lifecycle",
    targetState: "review",
    label: "의사결정 완료 → 문서 검토 요청",
  },
  // spec이 verified되면 convention을 compliant로 cascade
  {
    kind: "cascade",
    sourceMachine: "spec-impl",
    sourceState: "verified",
    targetMachine: "convention-compliance",
    targetState: "compliant",
    label: "스펙 검증 완료 → 컨벤션 준수",
  },
  // convention이 compliant여야 spec을 verified로 만들 수 있음 (gate enforcement)
  // 흐름: gate 통과 → convention:compliant → spec:verified 허용
  {
    kind: "guard",
    sourceMachine: "convention-compliance",
    sourceState: "compliant",
    targetMachine: "spec-impl",
    targetState: "verified",
    label: "스펙 검증에는 컨벤션 준수(게이트 통과) 필요",
  },
];

// ═══════════════════════════════════════════════════════════════
// 8. 프로세스 정의 — 일반화된 워크플로우
// ═══════════════════════════════════════════════════════════════

/** prefix 릴리스 프로세스 */
export const PREFIX_RELEASE_PROCESS: ProcessDefinition = {
  id: "prefix-release",
  label: "Prefix 릴리스",
  description: "draft 버전을 릴리스하고 활성화하여 주소를 개방하는 전체 흐름",
  steps: [
    {
      machineId: "version-lifecycle",
      targetState: "released",
      label: "버전 릴리스",
    },
    {
      machineId: "version-lifecycle",
      targetState: "active",
      label: "버전 활성화",
      preconditions: [{ machineId: "version-lifecycle", requiredState: "released" }],
    },
    {
      machineId: "address-state",
      targetState: "active",
      label: "주소 활성화",
      preconditions: [{ machineId: "version-lifecycle", requiredState: "active" }],
    },
    {
      machineId: "db-sync",
      targetState: "syncing",
      label: "DB 동기화 시작",
    },
    {
      machineId: "db-sync",
      targetState: "synced",
      label: "DB 동기화 완료",
      preconditions: [{ machineId: "db-sync", requiredState: "syncing" }],
    },
  ],
};

/** 문서 승인 프로세스 */
export const DOC_APPROVAL_PROCESS: ProcessDefinition = {
  id: "doc-approval",
  label: "문서 승인",
  description: "초안 → 검토 → 승인 → 컨벤션 검증까지의 전체 흐름",
  steps: [
    {
      machineId: "doc-lifecycle",
      targetState: "review",
      label: "검토 요청",
    },
    {
      machineId: "doc-lifecycle",
      targetState: "approved",
      label: "문서 승인",
      preconditions: [{ machineId: "doc-lifecycle", requiredState: "review" }],
    },
    {
      machineId: "convention-compliance",
      targetState: "compliant",
      label: "컨벤션 검증",
      preconditions: [{ machineId: "doc-lifecycle", requiredState: "approved" }],
    },
  ],
};

/** 서비스 폐기 프로세스 */
export const SERVICE_DEPRECATION_PROCESS: ProcessDefinition = {
  id: "service-deprecation",
  label: "서비스 폐기",
  description: "서비스 폐기 선언 → 이벤트 폐기 → 버전 폐기 → 주소 비활성화",
  steps: [
    {
      machineId: "service-status",
      targetState: "deprecated",
      label: "서비스 폐기 선언",
    },
    // cascade: service deprecated → event deprecated (자동)
    {
      machineId: "version-lifecycle",
      targetState: "deprecated",
      label: "관련 prefix 버전 폐기",
    },
    // cascade: version deprecated → address inactive (자동)
    {
      machineId: "doc-lifecycle",
      targetState: "deprecated",
      label: "관련 문서 폐기 예정",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 9. 레지스트리 빌더
// ═══════════════════════════════════════════════════════════════

import {
  DOC_LIFECYCLE_MACHINE,
  SPEC_IMPL_MACHINE,
  CONVENTION_MACHINE,
  SYNC_MACHINE,
} from "./state-model.js";

/** 시스템 전체 하네스 레지스트리 생성 */
export function createHarnessRegistry(): HarnessRegistry {
  const machines = new Map<string, StateMachineDefinition>();

  // 기존 4개 머신
  machines.set(DOC_LIFECYCLE_MACHINE.id, DOC_LIFECYCLE_MACHINE);
  machines.set(SPEC_IMPL_MACHINE.id, SPEC_IMPL_MACHINE);
  machines.set(CONVENTION_MACHINE.id, CONVENTION_MACHINE);
  machines.set(SYNC_MACHINE.id, SYNC_MACHINE);

  // 새 7개 머신
  machines.set(ADDRESS_STATE_MACHINE.id, ADDRESS_STATE_MACHINE);
  machines.set(VERSION_LIFECYCLE_MACHINE.id, VERSION_LIFECYCLE_MACHINE);
  machines.set(FLOW_STATE_MACHINE.id, FLOW_STATE_MACHINE);
  machines.set(SERVICE_STATE_MACHINE.id, SERVICE_STATE_MACHINE);
  machines.set(EVENT_STATE_MACHINE.id, EVENT_STATE_MACHINE);
  machines.set(METRIC_HEALTH_MACHINE.id, METRIC_HEALTH_MACHINE);
  machines.set(POLICY_STATE_MACHINE.id, POLICY_STATE_MACHINE);

  const processes = new Map<string, ProcessDefinition>();
  processes.set(PREFIX_RELEASE_PROCESS.id, PREFIX_RELEASE_PROCESS);
  processes.set(DOC_APPROVAL_PROCESS.id, DOC_APPROVAL_PROCESS);
  processes.set(SERVICE_DEPRECATION_PROCESS.id, SERVICE_DEPRECATION_PROCESS);

  return {
    machines,
    dependencies: SYSTEM_DEPENDENCIES,
    processes,
  };
}

/** 엔티티에 대한 복합 인스턴스 생성 */
export function createCompositeInstance(
  registry: HarnessRegistry,
  entityId: string,
  entityKind: string,
  machineIds: readonly string[],
): CompositeInstance {
  // createInstance는 상단에서 import됨
  const states = new Map<string, StateMachineInstance>();

  for (const mid of machineIds) {
    const machine = registry.machines.get(mid);
    if (machine) {
      states.set(mid, createInstance(machine, entityId));
    }
  }

  return { entityId, entityKind, states };
}
