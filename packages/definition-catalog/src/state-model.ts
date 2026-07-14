// @def.doc definition-state-model

/**
 * 유한 상태 모델 — 문서/시스템 상태 관리 일반화.
 *
 * 모든 상태 기반 프로세스를 동일한 구조로 표현:
 *   상태 정의 → 전이 규칙 → 전이 조건 → 검증 → 리포트
 *
 * 사용처:
 *   문서 lifecycle, 스펙 구현 단계, 컨벤션 준수, DB 동기화
 */

// ═══════════════════════════════════════════════════════════════
// 핵심 타입
// ═══════════════════════════════════════════════════════════════

/** 상태 정의 */
export interface StateDefinition<S extends string = string> {
  readonly id: S;
  readonly label: string;
  readonly terminal?: boolean;
}

/** 전이 규칙 */
export interface TransitionRule<S extends string = string> {
  readonly from: S;
  readonly to: S;
  readonly label: string;
  /** 전이 조건 — true면 전이 가능 */
  readonly guard?: (context: Record<string, unknown>) => boolean;
}

/** 상태 머신 정의 */
export interface StateMachineDefinition<S extends string = string> {
  readonly id: string;
  readonly label: string;
  readonly initial: S;
  readonly states: readonly StateDefinition<S>[];
  readonly transitions: readonly TransitionRule<S>[];
}

/** 상태 머신 인스턴스 */
export interface StateMachineInstance<S extends string = string> {
  readonly machineId: string;
  readonly entityId: string;
  current: S;
  readonly history: readonly StateTransitionRecord<S>[];
}

/** 전이 기록 */
export interface StateTransitionRecord<S extends string = string> {
  readonly from: S;
  readonly to: S;
  readonly label: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// 상태 머신 엔진
// ═══════════════════════════════════════════════════════════════

/** 주어진 상태에서 가능한 전이 목록 */
export function availableTransitions<S extends string>(
  machine: StateMachineDefinition<S>,
  currentState: S,
  context: Record<string, unknown> = {},
): readonly TransitionRule<S>[] {
  return machine.transitions.filter(
    (t) => t.from === currentState && (t.guard ? t.guard(context) : true),
  );
}

/** 전이 실행 */
export function transition<S extends string>(
  machine: StateMachineDefinition<S>,
  instance: StateMachineInstance<S>,
  targetState: S,
  context: Record<string, unknown> = {},
): StateMachineInstance<S> {
  const rule = machine.transitions.find((t) => t.from === instance.current && t.to === targetState);
  if (!rule) {
    throw new Error(`전이 불가: ${instance.current} → ${targetState} (${machine.id})`);
  }
  if (rule.guard && !rule.guard(context)) {
    throw new Error(`전이 조건 불충족: ${rule.label} (${machine.id})`);
  }

  const record: StateTransitionRecord<S> = {
    from: instance.current,
    to: targetState,
    label: rule.label,
    timestamp: new Date().toISOString(),
    context: Object.keys(context).length > 0 ? context : undefined,
  };

  return {
    ...instance,
    current: targetState,
    history: [...instance.history, record],
  };
}

/** 인스턴스 생성 */
export function createInstance<S extends string>(
  machine: StateMachineDefinition<S>,
  entityId: string,
): StateMachineInstance<S> {
  return {
    machineId: machine.id,
    entityId,
    current: machine.initial,
    history: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// 검증 + 리포트
// ═══════════════════════════════════════════════════════════════

/** 상태별 엔티티 분포 */
export interface StateDistribution<S extends string = string> {
  readonly machineId: string;
  readonly distribution: Readonly<Record<S, number>>;
  readonly total: number;
}

/** 엔티티 목록에서 상태 분포 계산 */
export function computeDistribution<S extends string>(
  machineId: string,
  instances: readonly StateMachineInstance<S>[],
): StateDistribution<S> {
  const distribution = {} as Record<S, number>;
  for (const inst of instances) {
    distribution[inst.current] = (distribution[inst.current] ?? 0) + 1;
  }
  return { machineId, distribution, total: instances.length };
}

// ═══════════════════════════════════════════════════════════════
// 사전 정의 머신: 문서 lifecycle
// ═══════════════════════════════════════════════════════════════

export type DocLifecycleState = 'draft' | 'review' | 'approved' | 'deprecated' | 'archived';

export const DOC_LIFECYCLE_MACHINE: StateMachineDefinition<DocLifecycleState> = {
  id: 'doc-lifecycle',
  label: '문서 생명주기',
  initial: 'draft',
  states: [
    { id: 'draft', label: '초안' },
    { id: 'review', label: '검토중' },
    { id: 'approved', label: '승인' },
    { id: 'deprecated', label: '폐기예정' },
    { id: 'archived', label: '보관', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'review', label: '검토 요청' },
    { from: 'review', to: 'approved', label: '승인' },
    { from: 'review', to: 'draft', label: '반려' },
    { from: 'approved', to: 'deprecated', label: '폐기 예정' },
    { from: 'deprecated', to: 'archived', label: '보관' },
    { from: 'deprecated', to: 'approved', label: '폐기 철회' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 사전 정의 머신: 스펙 구현 단계
// ═══════════════════════════════════════════════════════════════

export type SpecImplState =
  | 'designed'
  | 'implementing'
  | 'implemented'
  | 'verified'
  | 'source-referenced';

export const SPEC_IMPL_MACHINE: StateMachineDefinition<SpecImplState> = {
  id: 'spec-impl',
  label: '스펙 구현 단계',
  initial: 'designed',
  states: [
    { id: 'designed', label: '설계 완료 (코드 없음)' },
    { id: 'implementing', label: '구현 중' },
    { id: 'implemented', label: '구현 완료 (코드 존재)' },
    { id: 'verified', label: '검증 완료 (테스트 통과)' },
    { id: 'source-referenced', label: '소스 참조 전환 완료', terminal: true },
  ],
  transitions: [
    { from: 'designed', to: 'implementing', label: '구현 시작' },
    { from: 'implementing', to: 'implemented', label: '구현 완료' },
    { from: 'implemented', to: 'verified', label: '테스트 통과' },
    { from: 'verified', to: 'source-referenced', label: '문서 코드블록 → 소스 참조' },
    { from: 'implementing', to: 'designed', label: '설계 변경으로 롤백' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 사전 정의 머신: 컨벤션 준수
// ═══════════════════════════════════════════════════════════════

export type ConventionState = 'unverified' | 'partial' | 'compliant' | 'violated';

export const CONVENTION_MACHINE: StateMachineDefinition<ConventionState> = {
  id: 'convention-compliance',
  label: '컨벤션 준수',
  initial: 'unverified',
  states: [
    { id: 'unverified', label: '미검증' },
    { id: 'partial', label: '부분 검증 (일부 증거)' },
    { id: 'compliant', label: '완전 준수 (100% coverage)' },
    { id: 'violated', label: '위반 감지' },
  ],
  transitions: [
    { from: 'unverified', to: 'partial', label: '증거 수집 시작' },
    { from: 'unverified', to: 'compliant', label: '전체 검증 통과' },
    { from: 'unverified', to: 'violated', label: '위반 감지' },
    { from: 'partial', to: 'compliant', label: '전체 검증 통과' },
    { from: 'partial', to: 'violated', label: '위반 감지' },
    { from: 'violated', to: 'partial', label: '부분 수정' },
    { from: 'violated', to: 'compliant', label: '전체 수정 완료' },
    { from: 'compliant', to: 'violated', label: '회귀 위반' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 사전 정의 머신: DB 동기화
// ═══════════════════════════════════════════════════════════════

export type SyncState = 'out-of-sync' | 'syncing' | 'synced' | 'drift-detected';

export const SYNC_MACHINE: StateMachineDefinition<SyncState> = {
  id: 'db-sync',
  label: 'DB 동기화',
  initial: 'out-of-sync',
  states: [
    { id: 'out-of-sync', label: '동기화 필요' },
    { id: 'syncing', label: '동기화 중' },
    { id: 'synced', label: '동기화 완료' },
    { id: 'drift-detected', label: 'drift 감지' },
  ],
  transitions: [
    { from: 'out-of-sync', to: 'syncing', label: '동기화 시작' },
    { from: 'syncing', to: 'synced', label: '동기화 완료' },
    { from: 'syncing', to: 'out-of-sync', label: '동기화 실패' },
    { from: 'synced', to: 'drift-detected', label: '파일 변경 감지' },
    { from: 'drift-detected', to: 'syncing', label: '재동기화' },
  ],
};
