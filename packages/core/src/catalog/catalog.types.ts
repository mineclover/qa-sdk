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
}

export interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
  readonly meta?: PrefixMeta;
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
