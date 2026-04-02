/**
 * Catalog — 범용 카탈로그 인터페이스.
 *
 * 차원 압축 기반 DSL DB의 핵심 스키마.
 * demo-snapshot의 DEMO_CATALOG는 이 인터페이스의 인스턴스이다.
 */

// ── PrefixMeta: prefix 자기 기술 메타데이터 ──────────────────────────────

/** prefix의 시각 형태 힌트 */
export type VisualShape =
  | "cube"      // 기본 큐브 (observation, entity)
  | "thin-bar"  // 얇은 바 (policy — 권한은 pass/fail 이진)
  | "flat-tile" // 납작한 타일 (event — 발생하고 사라짐)
  | "column"    // 세로 컬럼 (table — DB 컬럼)
  | "sphere"    // 구형 (relation — 관계)
  ;

/** 클릭 시 표시할 상세 정보 유형 */
export type DetailKind =
  | "schema"      // DB 스키마 (table)
  | "permission"  // 권한 매트릭스 (policy)
  | "event-def"   // 이벤트 구조 — actor×action×target (event)
  | "endpoint"    // API 경로 + 메서드 (observation/endpoint)
  | "flow-step"   // 흐름 단계 설명 (observation/flow_point)
  | "config"      // 설정/파라미터 (entity/service, data_policy)
  | "metric"      // 메트릭/통계 (pipeline_point)
  | "generic"     // 기본 정보
  ;

/** prefix 의미 카테고리 */
export type PrefixCategory =
  | "entity"
  | "event"
  | "relation"
  | "state"
  | "policy"
  | "observation"
  ;

/** 시각화 계층 (0=UI, 1=비즈니스, 2=인프라, 3=확장) */
export type LayerLevel = 0 | 1 | 2 | 3;

/** prefix 자기 기술 메타데이터 */
export interface PrefixMeta {
  readonly category?: PrefixCategory;
  readonly layer?: LayerLevel;
  readonly visualShape?: VisualShape;
  readonly heightRatio?: number;
  readonly detailKind?: DetailKind;
  readonly source?: { readonly module?: string; readonly file?: string };
}

// ── Axis ──────────────────────────────────────────────────────────────────

export interface AxisVersionSnapshot {
  readonly entries: readonly string[];
  readonly capacity?: number;
  readonly ko?: Record<string, string>;
}

export interface VersionedAxis {
  readonly id: string;
  readonly name: string;
  readonly versions: Record<string, AxisVersionSnapshot>;
}

// ── DimRef ────────────────────────────────────────────────────────────────

export type DimRef =
  | { readonly kind: "axis"; readonly axisId: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string };

// ── Prefix ────────────────────────────────────────────────────────────────

export interface PrefixVersionDef {
  readonly version: string;
  readonly axisVersions: Record<string, string>;
  readonly refEntries?: Record<string, { values: readonly number[]; refVersion: string }>;
  /** 경로 합산 세그먼트 (addressModel: "sum"일 때). 버전마다 세그먼트 구성이 다를 수 있음. */
  readonly segments?: readonly PathSegment[];
}

/** 주소 모델: product(전곱, 기본) | sum(경로 합산) */
export type AddressModel = "product" | "sum";

/**
 * 축 값 기반 분기 조건.
 * spec-core의 StateCondition과 동일 구조 — 축 이름 + 값 매칭.
 */
export interface AxisCondition {
  /** 축 라벨 (consumes 내 축) */
  readonly axis: string;
  /** entry 값 일치 (인덱스) */
  readonly eq?: number;
  /** entry 값 목록 포함 */
  readonly in?: readonly number[];
}

/** 이벤트 전이 대상 */
export interface EventTransition {
  readonly eventKey: string;
  readonly prefixId?: string;
}

/** 분기 라우팅 — 축 값에 따라 다른 이벤트로 전이 */
export interface BranchRoute {
  /** 분기 조건 (축 값 매칭) */
  readonly when: AxisCondition;
  /** 전이 대상 이벤트 */
  readonly transition: EventTransition;
}

/**
 * 경로 세그먼트 — prefix axis pool에서 선택적으로 소비하는 단위.
 *
 * 전곱은 pool의 모든 축을 1개 세그먼트로 소비하는 특수 케이스.
 * 합산은 각 세그먼트가 pool의 부분집합을 소비하고, 주소 범위를 연접한다.
 *
 * 관계가 꼭 있어야 합산은 아님 — 소비 구조는 자유.
 */
export interface PathSegment {
  /** 세그먼트 식별자 (prefix 내 유일) */
  readonly segmentId: string;
  /** prefix.dims 중 이 세그먼트가 소비하는 축 라벨 (부분집합) */
  readonly consumes: readonly string[];
  /** 각 소비 축의 capacity (consumes와 동일 순서). axis pool에서 파생 가능하나 명시 선언. */
  readonly shape: readonly number[];
  /** 전체 주소 공간에서의 시작 오프셋 */
  readonly addressOffset: number;
  /** 이 세그먼트의 주소 크기 (shape의 곱) */
  readonly size: number;
  /** 하위 세그먼트 (재귀, 깊이 무제한 — 비즈니스 흐름이 결정) */
  readonly children?: readonly PathSegment[];
  /** 세그먼트 전체 전이 (모든 값이 같은 이벤트로) */
  readonly transition?: EventTransition;
  /** 축 값별 분기 라우팅 (특정 값일 때만 전이) */
  readonly routes?: readonly BranchRoute[];
}

export interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
  readonly meta?: PrefixMeta;
  /** 주소 모델 (미선언 시 "product" 기본값) */
  readonly addressModel?: AddressModel;
}

// ── Table Schema ──────────────────────────────────────────────────────────

export type ColumnRef =
  | { readonly kind: "scalar"; readonly type: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string }
  | { readonly kind: "axis_ref"; readonly axisId: string };

export interface TableSchema {
  readonly table: string;
  readonly columns: Record<string, ColumnRef>;
}

// ── Catalog ───────────────────────────────────────────────────────────────

export interface Catalog {
  readonly id: string;
  readonly name: string;
  readonly axes: Record<string, VersionedAxis>;
  readonly prefixes: Record<string, PrefixDef>;
  readonly tables?: Record<string, TableSchema>;
}

// ── Catalog 유틸리티 타입 ─────────────────────────────────────────────────

/** Catalog에서 prefix 이름 리터럴 유니온 추출 */
export type PrefixIds<C extends Catalog> = keyof C["prefixes"] & string;

/** Catalog에서 axis 이름 리터럴 유니온 추출 */
export type AxisIds<C extends Catalog> = keyof C["axes"] & string;
