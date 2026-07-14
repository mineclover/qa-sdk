// @def.doc definition-harness

/**
 * 하네스 상태 파생 — 관찰 가능한 사실에서 11개 머신 상태를 자동 결정.
 *
 * 설계 원칙:
 *   - definition-catalog은 라이브러리 → I/O 금지
 *   - 모든 함수는 순수: 명시적 입력만 받고 상태 문자열 반환
 *   - CLI/서비스가 입력을 수집하여 전달
 *
 * 4가지 파생 전략:
 *   A. 직접 매핑 — 이미 상태 필드가 있으면 그대로 사용
 *   B. 규칙 기반 추론 — 관찰 사실에서 판단 규칙 적용
 *   C. 외부 Store 읽기 — Store의 status 필드를 그대로 매핑
 *   D. 시스템 관측 — 런타임 상태에서 파생
 */

import type {
  DocLifecycleState,
  SpecImplState,
  ConventionState,
  SyncState,
} from './state-model.js';
import type {
  AddressState,
  VersionLifecycleState,
  FlowState,
  ServiceState,
  EventState,
  MetricHealthState,
  PolicyState,
} from './harness-state-model.js';

// ═══════════════════════════════════════════════════════════════
// Group A: 직접 매핑
// ═══════════════════════════════════════════════════════════════

const VALID_DOC_LIFECYCLE = new Set<string>([
  'draft',
  'review',
  'approved',
  'deprecated',
  'archived',
]);

/** frontmatter.lifecycle → DocLifecycleState. 유효하지 않으면 "draft". */
export function deriveDocLifecycle(lifecycle: string): DocLifecycleState {
  return VALID_DOC_LIFECYCLE.has(lifecycle) ? (lifecycle as DocLifecycleState) : 'draft';
}

/** config/scan 비교로 동기화 상태 파생 */
export interface SyncDeriveInput {
  readonly configExists: boolean;
  readonly configCount: number;
  readonly scanCount: number;
  readonly checksumMatch: boolean;
}

export function deriveSyncState(input: SyncDeriveInput): SyncState {
  if (!input.configExists) return 'out-of-sync';
  if (input.configCount !== input.scanCount) return 'drift-detected';
  if (!input.checksumMatch) return 'drift-detected';
  return 'synced';
}

// ═══════════════════════════════════════════════════════════════
// Group B: 규칙 기반 추론
// ═══════════════════════════════════════════════════════════════

/** svc 필드 + 코드/테스트 존재 여부에서 추론 */
export interface SpecImplDeriveInput {
  readonly hasSvc: boolean;
  readonly hasCode: boolean;
  readonly hasTests: boolean;
  /** null = 알 수 없음 (테스트 실행 안 함) */
  readonly testsPass: boolean | null;
  readonly isSourceReferenced: boolean;
}

export function deriveSpecImplState(input: SpecImplDeriveInput): SpecImplState {
  // 소스 참조만 있는 문서 (코드 블록 없고 소스 참조만)
  if (input.isSourceReferenced) return 'source-referenced';
  // svc 없음 = 설계 단계
  if (!input.hasSvc) return 'designed';
  // svc 있지만 코드 없음
  if (!input.hasCode) return 'designed';
  // 코드 있고 테스트 있고 통과
  if (input.hasTests && input.testsPass === true) return 'verified';
  // 코드 있고 테스트 있지만 미통과/미확인
  if (input.hasCode && input.hasTests) return 'implemented';
  // 코드 있지만 테스트 없음
  if (input.hasCode) return 'implementing';
  return 'designed';
}

/** spec-tracker 증거에서 추론 */
export interface ConventionDeriveInput {
  readonly evidenceCount: number;
  /** 0~100 */
  readonly coverage: number;
  readonly hasFailures: boolean;
}

export function deriveConventionState(input: ConventionDeriveInput): ConventionState {
  if (input.hasFailures) return 'violated';
  if (input.evidenceCount === 0) return 'unverified';
  if (input.coverage >= 100) return 'compliant';
  return 'partial';
}

// ═══════════════════════════════════════════════════════════════
// Group C: 외부 Store 직접 읽기
// ═══════════════════════════════════════════════════════════════

const VALID_VERSION_LIFECYCLE = new Set<string>(['draft', 'released', 'active', 'deprecated']);
const VALID_FLOW_STATE = new Set<string>([
  'pending',
  'active',
  'completed',
  'abandoned',
  'blocked',
]);
const VALID_POLICY_STATE = new Set<string>(['candidate', 'approved', 'rejected', 'modified']);

/** VersionRecord.status → 그대로 매핑. null이면 "draft". */
export function deriveVersionLifecycle(status: string | null): VersionLifecycleState {
  if (status !== null && VALID_VERSION_LIFECYCLE.has(status)) {
    return status as VersionLifecycleState;
  }
  return 'draft';
}

/** FlowInstance.status → 그대로 매핑. null이면 "pending". */
export function deriveFlowState(status: string | null): FlowState {
  if (status !== null && VALID_FLOW_STATE.has(status)) {
    return status as FlowState;
  }
  return 'pending';
}

/** PolicyCandidate.status → 그대로 매핑. null이면 "candidate". */
export function derivePolicyState(status: string | null): PolicyState {
  if (status !== null && VALID_POLICY_STATE.has(status)) {
    return status as PolicyState;
  }
  return 'candidate';
}

// ═══════════════════════════════════════════════════════════════
// Group D: 시스템 관측
// ═══════════════════════════════════════════════════════════════

/** GateEngine dim별 encode/decode 플래그 조합 */
export interface AddressDeriveInput {
  readonly allDimsEncode: boolean;
  readonly allDimsDecode: boolean;
}

export function deriveAddressState(input: AddressDeriveInput): AddressState {
  if (input.allDimsEncode && input.allDimsDecode) return 'active';
  if (!input.allDimsEncode && input.allDimsDecode) return 'inactive';
  if (input.allDimsEncode && !input.allDimsDecode) return 'open';
  // !encode && !decode
  return 'reserved';
}

/** catalog 존재 + ownedPrefixes + deprecated 태그 */
export interface ServiceDeriveInput {
  readonly existsInCatalog: boolean;
  readonly hasOwnedPrefixes: boolean;
  readonly isDeprecated: boolean;
}

export function deriveServiceStatus(input: ServiceDeriveInput): ServiceState {
  if (!input.existsInCatalog) return 'retired';
  if (input.isDeprecated) return 'deprecated';
  return 'active';
}

/** event-catalog isCoreEvent + deprecated 마커 */
export interface EventDeriveInput {
  /** null = registry에서 제거됨 */
  readonly isActive: boolean | null;
  readonly isDeprecated: boolean;
}

export function deriveEventStatus(input: EventDeriveInput): EventState {
  if (input.isActive === null) return 'retired';
  if (input.isDeprecated) return 'deprecated';
  return 'active';
}

/** convergence 메트릭 값 vs 임계값 */
export interface MetricDeriveInput {
  readonly values: readonly number[];
  readonly warningThreshold: number;
  readonly criticalThreshold: number;
}

export function deriveMetricHealth(input: MetricDeriveInput | null): MetricHealthState {
  if (input === null || input.values.length === 0) return 'ok';
  const max = Math.max(...input.values);
  if (max >= input.criticalThreshold) return 'critical';
  if (max >= input.warningThreshold) return 'warning';
  return 'ok';
}

// ═══════════════════════════════════════════════════════════════
// 오케스트레이터 — 전체 파생
// ═══════════════════════════════════════════════════════════════

/**
 * 문서 1건의 전체 파생 입력.
 * null인 필드는 해당 머신을 파생하지 않음 (외부 서비스 미연결 등).
 */
export interface DeriveInputs {
  readonly docId: string;
  readonly frontmatter: { readonly lifecycle: string; readonly svc?: string };
  readonly sync: SyncDeriveInput;
  readonly specImpl: SpecImplDeriveInput;
  readonly convention: ConventionDeriveInput;
  readonly versionStatus: string | null;
  readonly flowStatus: string | null;
  readonly policyStatus: string | null;
  readonly address: AddressDeriveInput | null;
  readonly service: ServiceDeriveInput | null;
  readonly event: EventDeriveInput | null;
  readonly metric: MetricDeriveInput | null;
}

export interface DerivedStates {
  readonly 'doc-lifecycle': DocLifecycleState;
  readonly 'spec-impl': SpecImplState;
  readonly 'convention-compliance': ConventionState;
  readonly 'db-sync': SyncState;
  readonly 'version-lifecycle'?: VersionLifecycleState;
  readonly 'decision-flow'?: FlowState;
  readonly 'policy-candidate'?: PolicyState;
  readonly 'address-state'?: AddressState;
  readonly 'service-status'?: ServiceState;
  readonly 'event-status'?: EventState;
  readonly 'metric-health'?: MetricHealthState;
}

/** 전체 파생 — 문서 1건의 모든 머신 상태를 한번에 계산 */
export function deriveAllStates(inputs: DeriveInputs): DerivedStates {
  const result: Record<string, string> = {
    'doc-lifecycle': deriveDocLifecycle(inputs.frontmatter.lifecycle),
    'spec-impl': deriveSpecImplState(inputs.specImpl),
    'convention-compliance': deriveConventionState(inputs.convention),
    'db-sync': deriveSyncState(inputs.sync),
  };

  // Group C: 외부 Store — null이면 미연결이므로 skip
  if (inputs.versionStatus !== null) {
    result['version-lifecycle'] = deriveVersionLifecycle(inputs.versionStatus);
  }
  if (inputs.flowStatus !== null) {
    result['decision-flow'] = deriveFlowState(inputs.flowStatus);
  }
  if (inputs.policyStatus !== null) {
    result['policy-candidate'] = derivePolicyState(inputs.policyStatus);
  }

  // Group D: 시스템 관측 — null이면 미연결이므로 skip
  if (inputs.address !== null) {
    result['address-state'] = deriveAddressState(inputs.address);
  }
  if (inputs.service !== null) {
    result['service-status'] = deriveServiceStatus(inputs.service);
  }
  if (inputs.event !== null) {
    result['event-status'] = deriveEventStatus(inputs.event);
  }
  if (inputs.metric !== null) {
    result['metric-health'] = deriveMetricHealth(inputs.metric);
  }

  return result as unknown as DerivedStates;
}
