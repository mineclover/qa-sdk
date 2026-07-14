// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { TransformKind } from './data-schema.js';

// ── PipeSpec — 단일 파이프 노드 ──────────────────────────

export interface PipePort {
  /** 포트 ID (같은 방향 내 유일) */
  portId: string;
  direction: 'in' | 'out';
  facetType?: string;
  label?: string;
  required?: boolean;
}

/** 파이프 또는 특정 포트를 가리키는 연결 참조 */
export interface PortRef {
  pipeId: string;
  portId?: string;
}

export interface PipeSpec {
  /** 파이프 노드 ID (그래프 내 유일) */
  pipeId: string;
  version: string;
  description?: string;

  /** 트리거: 이 파이프를 시작시키는 이벤트 */
  trigger: {
    eventKey: string;
    entryConditions?: Constraint[];
  };

  /** 내부 패싯 흐름 (30종 흐름 제어) */
  flow: PipeFlow;

  /** typed 입출력 포트 선언 */
  ports?: PipePort[];

  /** 생산 이벤트: 이 파이프가 완료 시 발생시키는 이벤트 */
  produces?: string[];

  /** scope×aspect 분류 */
  scope?: string;
  aspect?: string;
}

// ── PipeGraph — 노드 간 연결 ─────────────────────────────

export interface PipeGraph {
  graphId: string;
  version: string;
  description?: string;

  /** 그래프에 속한 파이프 노드들 */
  pipes: PipeSpec[];

  /** 노드 간 연결 */
  connections: PipeConnection[];

  /** 그래프 진입점 */
  entryPipeId: string;

  /** 매니페스트 참조 */
  manifestVersion?: string;
}

/** 파이프 간 연결 (N:M 지원) */
export interface PipeConnection {
  from: string | string[] | PortRef | PortRef[];
  to: string | string[] | PortRef | PortRef[];
  kind: ConnectionKind;
  facetType?: string;
  condition?: string;
}

export type ConnectionKind =
  | 'next'
  | 'conditional'
  | 'event'
  | 'error'
  | 'compensate'
  | 'fan-out'
  | 'join'
  | 'feedback';

// ── PipeFlow — 30종 흐름 제어 ────────────────────────────

export type PipeFlow =
  // 기본
  | PipeStep
  | PipeSequence
  // 분기
  | PipeBranch
  | PipeOptional
  // 동시성
  | PipeParallel
  | PipeRace
  | PipeAwait
  // 내결함
  | PipeRetry
  | PipeFallback
  // 반복
  | PipeLoop
  // 트랜잭션
  | PipeCompensate
  | PipeTransitionScope
  // 비동기
  | PipeEmit
  // 정리
  | PipeFinally
  // 시간
  | PipeTimeout
  // 제어
  | PipeFeedback
  // 배치
  | PipeMap
  | PipeReduce
  | PipeBuffer
  | PipeFilter
  // 안정화
  | PipeCircuitBreaker
  | PipeThrottle
  | PipeDebounce
  // 데이터 변환
  | PipeSplit
  | PipeEnrich
  // 관측
  | PipeTap
  // 스트리밍
  | PipeResequence
  | PipeWindow
  // 상태
  | PipeDedup
  | PipeCorrelation;

// ── 기본 ──────────────────────────────────────────────

export interface PipeStep {
  kind: 'step';
  facet: string;
  eventKey?: string;
  constraints?: Constraint[];
  timeout?: number;

  /** 테스트 단계 힌트: 이 step이 대응하는 테스트 단계 */
  testPhase?: import('./test-tracking.js').TestPhase;

  /** 데이터 계약: 이 step의 입출력 스키마 + 접근 테이블 */
  dataContract?: StepDataContract;
}

/** 출력 필드 하나의 계보 힌트 — 어떤 입력이 이 출력에 기여했는가 */
export interface LineageHint {
  /** 이 출력에 기여하는 입력 필드명 목록 */
  sources: string[];
  /** 변환 종류 */
  transform: TransformKind;
}

export interface StepDataContract {
  /** 이 step이 기대하는 입력 필드 */
  consumes?: Record<string, { type: string; required: boolean; source?: string }>;
  /** 이 step이 보장하는 출력 필드 */
  produces?: Record<string, { type: string; required: boolean }>;
  /** 접근하는 테이블/컬럼 */
  accesses?: Array<{ schemaId: string; columns: string[]; mode: 'read' | 'write' | 'readwrite' }>;
  /** 출력 필드별 입력 기여 매핑 — 어떤 consumes가 어떤 produces에 기여하는가 */
  lineageHints?: Record<string, LineageHint>;
}

export interface PipeSequence {
  kind: 'sequence';
  steps: PipeFlow[];
}

// ── 분기 ──────────────────────────────────────────────

export interface PipeBranch {
  kind: 'branch';
  condition: string;
  paths: PipeFlow[];
}

export interface PipeOptional {
  kind: 'optional';
  step: PipeFlow;
}

// ── 동시성 ────────────────────────────────────────────

export interface PipeParallel {
  kind: 'parallel';
  steps: PipeFlow[];
}

export interface PipeRace {
  kind: 'race';
  steps: PipeFlow[];
}

export interface PipeAwait {
  kind: 'await';
  condition: string;
  timeout?: number;
  then: PipeFlow;
}

// ── 내결함 ────────────────────────────────────────────

export interface PipeRetry {
  kind: 'retry';
  step: PipeFlow;
  maxAttempts: number;
  backoff?: number;
}

export interface PipeFallback {
  kind: 'fallback';
  try: PipeFlow;
  catch: PipeFlow;
}

// ── 반복 ──────────────────────────────────────────────

export interface PipeLoop {
  kind: 'loop';
  body: PipeFlow;
  until: string;
  maxIterations?: number;
}

// ── 트랜잭션 ──────────────────────────────────────────

export interface PipeCompensate {
  kind: 'compensate';
  forward: PipeFlow;
  compensate: PipeFlow;
}

/** 선언적 비즈니스 원자 경계 — "전부 되거나 전부 안 되거나" */
export interface PipeTransitionScope {
  kind: 'transition-scope';
  /** 전이 식별자 */
  transitionId: string;
  /** 전이 본체 — 이 안의 모든 동작이 원자적으로 성공하거나 실패 */
  body: PipeFlow;
  /** 이 전이에 소속된 이벤트 목록 */
  events: string[];
  /** 실패 시 보상 (선택) */
  compensate?: PipeFlow;
}

// ── 비동기 ────────────────────────────────────────────

export interface PipeEmit {
  kind: 'emit';
  eventKey: string;
  payload?: string;
}

// ── 정리 ──────────────────────────────────────────────

export interface PipeFinally {
  kind: 'finally';
  body: PipeFlow;
  cleanup: PipeFlow;
}

// ── 시간 ──────────────────────────────────────────────

export interface PipeTimeout {
  kind: 'timeout';
  body: PipeFlow;
  duration: number;
  onTimeout?: PipeFlow;
}

// ── 제어 ──────────────────────────────────────────────

export interface PipeFeedback {
  kind: 'feedback';
  body: PipeFlow;
  feedbackEvent: string;
  until: string;
  maxIterations?: number;
}

// ── 배치 ──────────────────────────────────────────────

export interface PipeMap {
  kind: 'map';
  itemFlow: PipeFlow;
  collection: string;
  concurrency?: number;
}

export interface PipeReduce {
  kind: 'reduce';
  step: PipeFlow;
  initial: string;
  accumulator: string;
}

export interface PipeBuffer {
  kind: 'buffer';
  body: PipeFlow;
  count?: number;
  duration?: number;
}

export interface PipeFilter {
  kind: 'filter';
  condition: string;
  step: PipeFlow;
}

// ── 안정화 ────────────────────────────────────────────

export interface PipeCircuitBreaker {
  kind: 'circuit-breaker';
  step: PipeFlow;
  failureThreshold: number;
  cooldown: number;
  halfOpenAttempts?: number;
}

export interface PipeThrottle {
  kind: 'throttle';
  step: PipeFlow;
  rate: number;
  interval: number;
}

export interface PipeDebounce {
  kind: 'debounce';
  step: PipeFlow;
  wait: number;
}

// ── 데이터 변환 ───────────────────────────────────────

export interface PipeSplit {
  kind: 'split';
  splitBy: string;
  itemFlow: PipeFlow;
}

export interface PipeEnrich {
  kind: 'enrich';
  source: string;
  mergeField: string;
  step: PipeFlow;
  timeout?: number;
}

// ── 관측 ──────────────────────────────────────────────

export interface PipeTap {
  kind: 'tap';
  observe: PipeFlow;
  step: PipeFlow;
}

// ── 스트리밍 ──────────────────────────────────────────

export interface PipeResequence {
  kind: 'resequence';
  orderBy: string;
  windowSize: number;
  step: PipeFlow;
}

export interface PipeWindow {
  kind: 'window';
  type: 'tumbling' | 'sliding' | 'session';
  size: number;
  slide?: number;
  gap?: number;
  body: PipeFlow;
}

// ── 상태 ──────────────────────────────────────────────

export interface PipeDedup {
  kind: 'dedup';
  keyField: string;
  ttl?: number;
  step: PipeFlow;
}

export interface PipeCorrelation {
  kind: 'correlation';
  requestEvent: string;
  responseEvent: string;
  correlationKey: string;
  timeout?: number;
  onMatch: PipeFlow;
  onTimeout?: PipeFlow;
}

// ── 공통 ──────────────────────────────────────────────

export interface Constraint {
  field: string;
  op: 'eq' | 'neq' | 'exists' | 'gt' | 'lt' | 'contains' | 'masked';
  value?: unknown;
}
