/**
 * Design Knowledge Graph — 노드 16종 + 엣지 18종 타입 정의.
 *
 * 좌표 시스템의 성장 나선을 추적하는 설계 시점 메타데이터 그래프.
 * 스펙: docs/specs/spec-engine/design-knowledge-graph.md
 */

// ═══════════════════════════════════════════════════════════════
//  Node Types (16종)
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
  readonly governs?: readonly string[];
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
  /** coordinate-design 등 FlowInstance와 연결된 경우 역참조 */
  readonly flowInstanceId?: string;
  /** address_context 등 DKG 외부 브릿지 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
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
  /** address_context 등 DKG 외부 브릿지 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
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

// ═══════════════════════════════════════════════════════════════
//  관측 루프 (Observation Loop) — SPEC-OBSERVATION-LOOP
//
//  정의: observation이 열리면 decision으로 판단하고 resolution으로 닫는 순환 구조.
//
//  루프 상태:
//    열림 (open)    — observation 생성됨. resolution 없음. 미해결.
//    연결됨 (linked) — prompts 엣지로 decision에 연결됨. 아직 resolve 안 됨.
//    닫힘 (closed)  — resolution 설정됨. outcome: accepted|deferred|rejected.
//
//  루프 경로:
//    1. 감지: observation 생성 (source: metric|manual|review|runtime)
//    2. 촉발: observation → prompts → decision (관측이 결정을 촉발)
//    3. 판단: decision 생성 (type: capacity|merge|deprecate|...)
//    4. 해소: observation.resolution = { decisionId, outcome, note }
//
//  intent별 루프 의무:
//    action-needed → 반드시 닫아야 함. health metric이 issue로 집계.
//    monitoring    → 닫지 않아도 됨. 조건 변화 시 재평가. health에서 제외.
//    completed     → 닫아야 함 (완료 보고).
//
//  자동 해소:
//    metric 기반 observation은 metric이 ok로 복귀하면 자동 resolve.
//    resolveRecoveredMetrics()가 이를 수행.
//
//  CLI:
//    dkg observe  → 루프 열기
//    dkg decide   → 판단 생성 (--spec으로 근거 연결 가능)
//    dkg resolve  → 루프 닫기
//    dkg link     → observation → decision prompts 엣지 연결
//    dkg timeline --open → 열린 루프 조회
// ═══════════════════════════════════════════════════════════════

/**
 * Observation 의도 분류.
 *
 *   "action-needed" — 조치 필요. health metric에서 issue로 집계됨. 루프를 반드시 닫아야 함.
 *   "monitoring"    — 추적 관찰. 즉시 조치 불필요. 루프 닫기 의무 없음.
 *   "completed"     — 작업 완료 기록. resolve 대상.
 *
 * intent 미지정 시 기본 판정:
 *   source=metric → action-needed
 *   source=manual/review + suggestion 있음 → action-needed
 *   source=manual/review + suggestion 없음 → monitoring
 */
export type ObservationIntent = "action-needed" | "monitoring" | "completed";

export interface ObservationNode {
  readonly kind: "observation";
  readonly id: string;
  readonly date: string;
  readonly source: "runtime" | "review" | "metric" | "manual";
  readonly subjects: readonly string[];
  readonly finding: string;
  readonly suggestion?: ObservationSuggestion;
  /** 의도 분류. 미지정 시 source + suggestion으로 자동 판정 */
  readonly intent?: ObservationIntent;
  /** feedback request 등 외부 브릿지 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
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

// ── Skill 노드 ──────────────────────────────────────────────

export type SkillCategory = "read" | "write" | "analysis" | "chain";

/** Skill이 전문화되는 시나리오 컨텍스트 */
export interface SkillSpecialization {
  /** core DkgConfig의 specialization은 확장 가능한 메타데이터를 허용한다. */
  readonly [key: string]: unknown;
  /** 대상 도메인 */
  readonly domains?: readonly string[];
  /** 대상 DSL 번들 */
  readonly dslBundles?: readonly string[];
  /** 대상 prefix (구체적) */
  readonly prefixes?: readonly string[];
  /** 검증하는 intent-link */
  readonly intentLinks?: readonly string[];
  /** 강제하는 constraint */
  readonly constraints?: readonly string[];
  /** 검증하는 불변조건 (DSL invariant 텍스트) */
  readonly invariants?: readonly string[];
  /** 이 skill이 측정하는 metric ID들 */
  readonly metrics?: readonly string[];
  /** 외부 API 힌트 (서비스 대시보드/자동 관측용) */
  readonly api?: string | readonly string[];
  /** 자동 observation 생성 여부 */
  readonly autoObservation?: boolean;
  /** 자동 observation ID 템플릿 */
  readonly observationTemplate?: string;
}

export interface SkillNode {
  readonly kind: "skill";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;
  /** 다룰 수 있는 노드 종류 (문자열 — "prefix" | "axis" | ... ) */
  readonly targetKinds: readonly string[];
  /** 입력 설명 */
  readonly input: string;
  /** 출력 설명 */
  readonly output: string;
  /** 의존하는 다른 skill ID */
  readonly depends?: readonly string[];
  /** 시나리오 전문화 — 이 skill이 구체적으로 어떤 DSL/도메인/prefix를 소비하는가 */
  readonly specialization?: SkillSpecialization;
}

// ── Transition Spec 노드 ─────────────────────────────────

export interface TransitionSpecNode {
  readonly kind: "transition-spec";
  readonly id: string;
  /** 전이 이름. 형식: <domain>.<entity>.<operation> */
  readonly transition: string;
  readonly version: string;
  readonly matchMode: "single" | "ordered" | "unordered" | "windowed";
  readonly coordinateCount: number;
  readonly effectKind: "create" | "update" | "move" | "consume" | "open" | "close";
  /** 모든 참조 축 (matchAxes ∪ inputAxes ∪ outputAxes) */
  readonly slotRefs: readonly string[];
  /** 이벤트 매칭에 사용하는 축 (match.coordinates 차원) */
  readonly matchAxes: readonly string[];
  /** 상태 전제조건 축 (input.all 참조) — 읽기 */
  readonly inputAxes: readonly string[];
  /** 상태 변경 축 (output.set 참조) — 쓰기 */
  readonly outputAxes: readonly string[];
}

// ── 테이블 노드 ──────────────────────────────────────────

export interface TableNode {
  readonly kind: "table";
  readonly id: string;
  readonly name: string;
  /** 컬럼 이름 목록 */
  readonly columns: readonly string[];
}

// ── FlowSchema 노드 ──────────────────────────────────────

export type FlowSchemaGatePhase =
  | "perceive"
  | "interpret"
  | "evaluate"
  | "decide"
  | "plan"
  | "execute"
  | "reflect";

export type FlowSchemaGateWeight = "core" | "structural" | "tactical";

export interface FlowSchemaGateSummary {
  readonly id: string;
  readonly name: string;
  readonly phase: FlowSchemaGatePhase;
  readonly weight: FlowSchemaGateWeight;
}

export interface FlowSchemaNode {
  readonly kind: "flow-schema";
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly gates: readonly FlowSchemaGateSummary[];
  readonly totalPaths: number;
  readonly coreGateIds: readonly string[];
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
  | DslBundleNode
  | SkillNode
  | TransitionSpecNode
  | TableNode
  | FlowSchemaNode;

export type DkgNodeKind = DkgNode["kind"];

/**
 * kind → node details (id/kind/name 제외) 맵.
 * TraceResult.details의 타입 안전한 접근에 사용.
 *
 * @example
 * ```ts
 * function getPrefixDetails(result: TraceResult): DkgNodeDetails<"prefix"> {
 *   return result.details as DkgNodeDetails<"prefix">;
 * }
 * ```
 */
export type DkgNodeDetailsMap = {
  [K in DkgNode["kind"]]: Omit<Extract<DkgNode, { kind: K }>, "id" | "kind" | "name">;
};

/** 특정 kind의 details 타입 */
export type DkgNodeDetails<K extends DkgNodeKind> = DkgNodeDetailsMap[K];

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
  /** 실제 검사 시 severity 판정. analyze-impact처럼 잠재적 위반 목록에는 미설정. */
  readonly severity?: "error" | "warning";
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
