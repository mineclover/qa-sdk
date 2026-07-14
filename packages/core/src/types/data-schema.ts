// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── DataSchema — 컬럼 정의 + 패싯 역할 ───────────────

export interface DataSchema {
  schemaId: string;
  version: string;
  columns: Record<string, DataColumn>;
  primaryKey: string[];
  schemaHash: string;
}

export interface DataColumn {
  ref: ColumnRef;
  facetRole?: FacetRole;
  required: boolean;
  defaultValue?: unknown;
  constraints?: ColumnConstraint[];
}

export type FacetRole = 'produced' | 'consumed' | 'derived' | 'managed' | 'identity';

export interface ColumnConstraint {
  type: 'not-null' | 'unique' | 'range' | 'pattern' | 'enum' | 'fk';
  value?: unknown;
}

export type ColumnRef =
  | { kind: 'scalar'; type: string }
  | { kind: 'axis_ref'; axisId: string }
  | { kind: 'table_ref'; table: string }
  | { kind: 'prefix_ref'; prefixId: string };

// ── DataRelation — 엔티티 간 관계 ────────────────────

export interface DataRelation {
  relationId: string;
  source: { schemaId: string; column: string };
  target: { schemaId: string; column: string };
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  ownership: 'owns' | 'references' | 'embeds';
  cascade: CascadeRule;
}

export interface CascadeRule {
  onDelete: 'cascade' | 'set-null' | 'restrict' | 'no-action';
  onUpdate: 'cascade' | 'restrict' | 'no-action';
}

// ── FieldLineage — 필드 변환 추적 ────────────────────

export interface FieldLineage {
  target: FieldRef;
  sources: FieldRef[];
  transform: TransformKind;
  expression?: string;
  pipeId: string;
  stepPath: string;
  /** 이 변환을 수행한 패싯 (PipeStep.facet) */
  facet?: string;
}

export interface FieldRef {
  schemaId: string;
  column: string;
}

export type TransformKind =
  | 'direct'
  | 'rename'
  | 'compute'
  | 'aggregate'
  | 'lookup'
  | 'derive'
  | 'concat'
  | 'split'
  | 'filter'
  | 'cast';

// ── SchemaVersion — 변경 이력 + 호환성 ───────────────

export interface SchemaVersion {
  schemaId: string;
  version: string;
  previousVersion?: string;
  changes: SchemaChange[];
  compatibility: SchemaCompatibility;
  changelog?: string;
  createdAt: string;
}

export interface SchemaChange {
  type: SchemaChangeType;
  column: string;
  detail?: string;
}

export type SchemaChangeType =
  | 'add-optional'
  | 'add-required'
  | 'remove'
  | 'rename'
  | 'type-change'
  | 'constraint-add'
  | 'constraint-remove'
  | 'default-add'
  | 'default-change';

export type SchemaCompatibility = 'backward' | 'forward' | 'full' | 'breaking';

// ── DataContract — 스키마 호환 검증 ──────────────────

export interface FieldSet {
  fields: Record<string, FieldSpec>;
}

export interface FieldSpec {
  type: string;
  required: boolean;
  source?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  missingFields: string[];
  typeMismatches: Array<{ field: string; expected: string; actual: string }>;
  extraFields: string[];
  breaking: boolean;
}
