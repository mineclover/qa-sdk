// @def.boundary convergence-layer-group
/**
 * DKG 타입 부분집합 — convergence가 의존하는 최소 노드 타입만 복제.
 *
 * 원본: spec-core/src/dkg/dkg.types.ts
 * convergence 패키지가 spec-core에 역의존하지 않도록 복제.
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
