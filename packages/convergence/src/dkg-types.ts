// @def.boundary convergence-layer-group
/**
 * DKG 타입 부분집합 — convergence가 의존하는 최소 노드 타입만 복제.
 *
 * 원본: dkg/src/dkg.types.ts (spec-core/dkg는 re-export만 담당)
 * convergence 패키지가 dkg/spec-core에 역의존하지 않도록 복제.
 * drift 방지: dkg-enrichment/src/type-drift.test.ts가 정본과 상호 할당 가능함을 검사한다.
 * 타입만 정의 (런타임 코드 없음).
 */

// ── 관측 루프 의도 ────────────────────────────────────────

export type ObservationIntent = 'action-needed' | 'monitoring' | 'completed';

export type ObservationSuggestion =
  | { readonly kind: 'merge'; readonly targets: readonly string[]; readonly into: string }
  | { readonly kind: 'split'; readonly target: string; readonly into: readonly string[] }
  | { readonly kind: 'deprecate'; readonly target: string; readonly reason: string }
  | { readonly kind: 'add-entry'; readonly axis: string; readonly entry: string }
  | { readonly kind: 'add-constraint'; readonly rule: string }
  | { readonly kind: 'revise-decision'; readonly decisionId: string; readonly reason: string };

/** observation을 만든 producer·버전·입력 (G3 cache key·differential test 근거) */
export interface ObservationProvenance {
  /** producer 식별자 — 예: 'convergence/metric-registry' */
  readonly producer: string;
  /** producer 패키지 버전 */
  readonly producerVersion: string;
  /** 규칙·알고리즘 버전 (G3 cache key 구성요소) */
  readonly algorithmVersion?: string;
  /** 입력 canonical digest (G3에서 채움) */
  readonly inputDigest?: string;
  /** catalog digest */
  readonly catalogDigest?: string;
}

// ── 노드 타입 ─────────────────────────────────────────────

export interface DecisionNode {
  readonly kind: 'decision';
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly context: string;
  readonly rationale: string;
  readonly flowInstanceId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly alternatives?: readonly string[];
  readonly reversalConditions?: readonly string[];
  readonly lifecycle: 'active' | 'superseded' | 'reversed';
}

export interface ObservationNode {
  readonly kind: 'observation';
  readonly id: string;
  readonly date: string;
  readonly source: 'runtime' | 'review' | 'metric' | 'manual';
  readonly subjects: readonly string[];
  readonly finding: string;
  readonly suggestion?: ObservationSuggestion;
  readonly intent?: ObservationIntent;
  /** feedback request 등 외부 브릿지 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** 자동 생성 observation의 출처. 수동·기존 저장 observation은 없을 수 있다 */
  readonly provenance?: ObservationProvenance;
  readonly resolution?: {
    readonly decisionId: string;
    readonly outcome: 'accepted' | 'deferred' | 'rejected';
    readonly note?: string;
  };
}

export interface ConstraintNode {
  readonly kind: 'constraint';
  readonly id: string;
  readonly rule: string;
  readonly formal?: string;
  readonly scope: readonly string[];
  readonly lifecycle: 'active' | 'suspended' | 'retired';
}

export interface PrefixNode {
  readonly kind: 'prefix';
  readonly id: string;
  readonly name: string;
  readonly dimLabels: readonly string[];
  readonly category?: 'entity' | 'event' | 'relation' | 'state' | 'policy' | 'observation';
  readonly lifecycle?: 'draft' | 'active' | 'deprecated' | 'archived';
}

// ── Decision Scaffold 타입 ────────────────────────────────

export type DecisionType =
  | 'capacity'
  | 'new-axis'
  | 'new-prefix'
  | 'dim-add'
  | 'merge'
  | 'deprecate';

export interface CapacityParams {
  readonly axis: string;
  readonly currentUsed: number;
  readonly currentCapacity: number;
  readonly proposedCapacity: number;
}

export interface NewAxisParams {
  readonly axisId: string;
  readonly entries: readonly string[];
  readonly capacity: number;
}

export interface NewPrefixParams {
  readonly prefixId: string;
  readonly dims: readonly string[];
  readonly domain?: string;
}

export interface DimAddParams {
  readonly prefix: string;
  readonly newDim: string;
  readonly defaultValue?: number;
}

export interface MergeParams {
  readonly targets: readonly string[];
  readonly into: string;
  readonly overlapEntries?: readonly string[];
}

export interface DeprecateParams {
  readonly target: string;
  readonly replacement?: string;
}

export type DecisionScaffoldParams =
  | CapacityParams
  | NewAxisParams
  | NewPrefixParams
  | DimAddParams
  | MergeParams
  | DeprecateParams;
