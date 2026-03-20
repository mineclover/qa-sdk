/**
 * Design Knowledge Graph — 노드 11종 + 엣지 18종 타입 정의.
 *
 * 좌표 시스템의 성장 나선을 추적하는 설계 시점 메타데이터 그래프.
 * 스펙: docs/specs/spec-engine/design-knowledge-graph.md
 */

// ═══════════════════════════════════════════════════════════════
//  Node Types (11종)
// ═══════════════════════════════════════════════════════════════

// ── 승계: DEMO_CATALOG + spec-engine (4종) ──────────────────

export interface AxisNode {
  readonly kind: "axis";
  readonly id: string;
  readonly name: string;
  readonly currentVersions: readonly string[];
}

export type PrefixLifecycle = "draft" | "active" | "deprecated" | "archived";

export interface PrefixNode {
  readonly kind: "prefix";
  readonly id: string;
  readonly name: string;
  readonly dimLabels: readonly string[];
  /** schema category — entity/event/relation/state/policy/observation */
  readonly category?: "entity" | "event" | "relation" | "state" | "policy" | "observation";
  /** lifecycle — draft→active→deprecated→archived */
  readonly lifecycle?: PrefixLifecycle;
}

export interface SpecNode {
  readonly kind: "spec";
  readonly id: string;
  readonly type: "req" | "feat" | "uc" | "evt" | "ls" | "adr";
  readonly title: string;
  readonly lifecycle: "draft" | "active" | "deprecated";
}

export interface SchemaNode {
  readonly kind: "schema";
  readonly id: string;
  readonly category: "entity" | "event" | "relation" | "state" | "policy" | "observation";
  readonly version: string;
}

// ── DKG 고유: 설계 + 운영 (4종) ────────────────────────────

export interface DecisionNode {
  readonly kind: "decision";
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly context: string;
  readonly rationale: string;
  readonly alternatives?: readonly string[];
  readonly reversalConditions?: readonly string[];
  readonly lifecycle: "active" | "superseded" | "reversed";
}

export interface VersionEventNode {
  readonly kind: "version-event";
  readonly id: string;
  readonly subjectId: string;
  readonly subjectKind: "axis" | "prefix";
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly date: string;
  readonly changes: readonly VersionChange[];
  readonly impact: string;
}

export interface VersionChange {
  readonly kind:
    | "entry-added"
    | "entry-deactivated"
    | "capacity-changed"
    | "dim-added"
    | "ref-changed";
  readonly detail: string;
}

export interface ConstraintNode {
  readonly kind: "constraint";
  readonly id: string;
  readonly rule: string;
  readonly formal?: string;
  readonly scope: readonly string[];
  readonly lifecycle: "active" | "suspended" | "retired";
}

export interface ObservationNode {
  readonly kind: "observation";
  readonly id: string;
  readonly date: string;
  readonly source: "runtime" | "review" | "metric" | "manual";
  readonly subjects: readonly string[];
  readonly finding: string;
  readonly suggestion?: ObservationSuggestion;
  readonly resolution?: {
    readonly decisionId: string;
    readonly outcome: "accepted" | "deferred" | "rejected";
    readonly note?: string;
  };
}

export type ObservationSuggestion =
  | { readonly kind: "merge"; readonly targets: readonly string[]; readonly into: string }
  | { readonly kind: "split"; readonly target: string; readonly into: readonly string[] }
  | { readonly kind: "deprecate"; readonly target: string; readonly reason: string }
  | { readonly kind: "add-entry"; readonly axis: string; readonly entry: string }
  | { readonly kind: "add-constraint"; readonly rule: string }
  | { readonly kind: "revise-decision"; readonly decisionId: string; readonly reason: string };

// ── DKG 고유: 외부/구조 (3종) ──────────────────────────────

export interface DomainNode {
  readonly kind: "domain";
  readonly id: string;
  readonly name: string;
  readonly prefixes: readonly string[];
  readonly sharedAxes: readonly string[];
  readonly boundary: {
    readonly exports: readonly string[];
    readonly internal: readonly string[];
  };
  readonly rationale?: string;
}

export interface ConsumerNode {
  readonly kind: "consumer";
  readonly id: string;
  readonly type: "service" | "client" | "tool" | "external";
  readonly intendedPrefixes: readonly string[];
  readonly rationale?: string;
}

export interface IntentLinkNode {
  readonly kind: "intent-link";
  readonly id: string;
  readonly endpoints: readonly string[];
  readonly via: string;
  readonly intent: string;
  readonly invariant?: string;
}

export type DslLifecycle = "draft" | "active" | "deprecated";

export interface DslBundleNode {
  readonly kind: "dsl-bundle";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly memberPrefixes: readonly string[];
  readonly serviceBindingPrefix: string;
  readonly fixedDims: readonly string[];
  readonly invariants?: readonly string[];
  /** lifecycle — draft→active→deprecated */
  readonly lifecycle?: DslLifecycle;
}

// ── 노드 유니온 ───────────────────────────────────────────

export type DkgNode =
  | AxisNode
  | PrefixNode
  | SpecNode
  | SchemaNode
  | DecisionNode
  | VersionEventNode
  | ConstraintNode
  | ObservationNode
  | DomainNode
  | ConsumerNode
  | IntentLinkNode
  | DslBundleNode;

export type DkgNodeKind = DkgNode["kind"];

// ═══════════════════════════════════════════════════════════════
//  Edge Types (18종)
// ═══════════════════════════════════════════════════════════════

export type DkgEdgeType =
  // spec-engine 승계 (5종)
  | "satisfies"
  | "implements"
  | "tests"
  | "traces-to"
  | "depends-on"
  // 설계 순방향 (5종)
  | "composes"
  | "references"
  | "governs"
  | "justifies"
  | "constrains"
  // 도메인/소비/연결 (4종)
  | "contains"
  | "bridges"
  | "consumes"
  | "binds"
  // 운영 역방향 (2종)
  | "observes"
  | "prompts"
  // 진화 추적 (2종)
  | "evolves-from"
  | "supersedes";

export interface DkgEdge {
  readonly type: DkgEdgeType;
  readonly from: string;
  readonly to: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════
//  Impact Analysis Types
// ═══════════════════════════════════════════════════════════════

export interface ImpactAnalysisInput {
  readonly type:
    | "entry-added"
    | "entry-deactivated"
    | "capacity-changed"
    | "dim-added"
    | "ref-changed"
    | "version-bump"
    | "new-prefix";
  readonly target: {
    readonly axis?: string;
    readonly prefix?: string;
    readonly fromVersion?: string;
    readonly toVersion?: string;
  };
  readonly detail?: string;
}

export interface ImpactAnalysisResult {
  readonly strideBreak: boolean;
  readonly shapeChange?: { readonly from: readonly number[]; readonly to: readonly number[] };
  readonly affectedPrefixes: readonly AffectedPrefix[];
  readonly affectedDomains: readonly AffectedDomain[];
  readonly affectedConsumers: readonly AffectedConsumer[];
  readonly migrationRequired: boolean;
  readonly autoMigratable: boolean;
  readonly constraintViolations: readonly ConstraintViolation[];
  readonly brokenIntentLinks: readonly BrokenIntentLink[];
}

export interface AffectedPrefix {
  readonly id: string;
  readonly reason: "composes" | "references";
  readonly distance: number;
}

export interface AffectedDomain {
  readonly id: string;
  readonly affectedPrefixes: readonly string[];
}

export interface AffectedConsumer {
  readonly id: string;
  readonly via: string;
}

export interface ConstraintViolation {
  readonly constraintId: string;
  readonly rule: string;
}

export interface BrokenIntentLink {
  readonly id: string;
  readonly invariant: string;
}

// ═══════════════════════════════════════════════════════════════
//  Decision Scaffold Types
// ═══════════════════════════════════════════════════════════════

export type DecisionType =
  | "capacity"
  | "new-axis"
  | "new-prefix"
  | "dim-add"
  | "merge"
  | "deprecate";

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

// ═══════════════════════════════════════════════════════════════
//  Inferred Migrator Types
// ═══════════════════════════════════════════════════════════════

export type MigratorPattern =
  | "identity"
  | "append-dim"
  | "remove-dim"
  | "reorder"
  | "composite"
  | "unknown";

export interface InferredMigrator {
  readonly pattern: MigratorPattern;
  readonly migrator: ((coords: number[]) => number[]) | null;
  readonly description: string;
  readonly warnings?: readonly string[];
}
