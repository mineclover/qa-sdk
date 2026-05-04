// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 데이터 계약 — 스키마 호환 검증 + 계보 수집 + 버전 수집
 */

import type {
  DataSchema, DataColumn, DataRelation,
  FieldLineage, FieldRef,
  SchemaVersion, SchemaChange, SchemaChangeType, SchemaCompatibility,
  FieldSet, FieldSpec, CompatibilityResult,
} from "../types/data-schema.js";

// ── 스키마 호환 검증 ─────────────────────────────────

/** 생산자 스키마와 소비자 기대 스키마의 호환성 검증 */
export function checkCompatibility(
  producer: FieldSet,
  consumer: FieldSet,
): CompatibilityResult {
  const missingFields: string[] = [];
  const typeMismatches: CompatibilityResult["typeMismatches"] = [];
  const extraFields: string[] = [];

  // 소비자가 기대하는 필드가 생산자에 있는지
  for (const [name, spec] of Object.entries(consumer.fields)) {
    const produced = producer.fields[name];
    if (!produced) {
      if (spec.required) missingFields.push(name);
      continue;
    }
    if (produced.type !== spec.type) {
      typeMismatches.push({ field: name, expected: spec.type, actual: produced.type });
    }
  }

  // 생산자에 있지만 소비자가 기대하지 않는 필드 (상위 호환)
  for (const name of Object.keys(producer.fields)) {
    if (!consumer.fields[name]) extraFields.push(name);
  }

  const breaking = missingFields.length > 0 || typeMismatches.length > 0;

  return {
    compatible: !breaking,
    missingFields,
    typeMismatches,
    extraFields,
    breaking,
  };
}

// ── 스키마 해시 ──────────────────────────────────────

/** DataSchema의 구조적 해시 계산 (FNV-1a 32bit — IR computeSchemaHash와 동일 알고리즘) */
export function computeSchemaHash(schema: DataSchema): string {
  const sorted = Object.entries(schema.columns)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, col]) => `${name}:${columnRefToString(col.ref)}:${col.required}`);
  return fnv1a32(sorted.join("|"));
}

/** FNV-1a 32bit 해시 — meta-semantic/ir-types.ts와 동일 알고리즘 */
function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function columnRefToString(ref: DataColumn["ref"]): string {
  switch (ref.kind) {
    case "scalar": return `scalar:${ref.type}`;
    case "axis_ref": return `axis:${ref.axisId}`;
    case "table_ref": return `table:${ref.table}`;
    case "prefix_ref": return `prefix:${ref.prefixId}`;
  }
}

// ── 스키마 버전 비교 + 변경 수집 ─────────────────────

/** 두 DataSchema 버전 간 변경 사항 수집 */
export function collectSchemaChanges(
  oldSchema: DataSchema,
  newSchema: DataSchema,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const oldCols = new Set(Object.keys(oldSchema.columns));
  const newCols = new Set(Object.keys(newSchema.columns));

  // 제거된 컬럼
  for (const col of oldCols) {
    if (!newCols.has(col)) {
      changes.push({ type: "remove", column: col });
    }
  }

  // 추가된 컬럼
  for (const col of newCols) {
    if (!oldCols.has(col)) {
      const newCol = newSchema.columns[col];
      changes.push({
        type: newCol.required ? "add-required" : "add-optional",
        column: col,
      });
    }
  }

  // 변경된 컬럼
  for (const col of oldCols) {
    if (!newCols.has(col)) continue;
    const oldCol = oldSchema.columns[col];
    const newCol = newSchema.columns[col];

    // 타입 변경
    if (columnRefToString(oldCol.ref) !== columnRefToString(newCol.ref)) {
      changes.push({ type: "type-change", column: col, detail: `${columnRefToString(oldCol.ref)} → ${columnRefToString(newCol.ref)}` });
    }

    // 제약 변경
    const oldConstraints = (oldCol.constraints ?? []).map(c => c.type).toSorted();
    const newConstraints = (newCol.constraints ?? []).map(c => c.type).toSorted();
    const addedConstraints = newConstraints.filter(c => !oldConstraints.includes(c));
    const removedConstraints = oldConstraints.filter(c => !newConstraints.includes(c));

    for (const c of addedConstraints) {
      changes.push({ type: "constraint-add", column: col, detail: c });
    }
    for (const c of removedConstraints) {
      changes.push({ type: "constraint-remove", column: col, detail: c });
    }

    // 기본값 변경
    if (oldCol.defaultValue === undefined && newCol.defaultValue !== undefined) {
      changes.push({ type: "default-add", column: col });
    } else if (oldCol.defaultValue !== undefined && newCol.defaultValue !== undefined
      && oldCol.defaultValue !== newCol.defaultValue) {
      changes.push({ type: "default-change", column: col });
    }
  }

  return changes;
}

/** 변경 목록에서 호환성 판별 */
export function determineCompatibility(changes: SchemaChange[]): SchemaCompatibility {
  const breakingTypes: Set<SchemaChangeType> = new Set(["add-required", "remove", "rename", "type-change"]);
  const hasBreaking = changes.some(c => breakingTypes.has(c.type));
  const hasConstraintAdd = changes.some(c => c.type === "constraint-add");

  if (hasBreaking) return "breaking";
  if (hasConstraintAdd) return "forward"; // 기존 데이터가 새 제약을 위반할 수 있음
  if (changes.length === 0) return "full";
  return "backward"; // add-optional, constraint-remove, default-add/change만
}

/** SchemaVersion 생성 */
export function createSchemaVersion(
  oldSchema: DataSchema,
  newSchema: DataSchema,
  changelog?: string,
): SchemaVersion {
  const changes = collectSchemaChanges(oldSchema, newSchema);
  return {
    schemaId: newSchema.schemaId,
    version: newSchema.version,
    previousVersion: oldSchema.version,
    changes,
    compatibility: determineCompatibility(changes),
    changelog,
    createdAt: new Date().toISOString(),
  };
}

// ── 계보 수집 ─────────────────────────────────────────

export class LineageCollector {
  private readonly lineages: FieldLineage[] = [];

  /** 계보 기록 추가 */
  record(lineage: FieldLineage): void {
    this.lineages.push(lineage);
  }

  /** 특정 필드의 원본 추적 (역방향) */
  traceOrigins(field: FieldRef): FieldLineage[] {
    const result: FieldLineage[] = [];
    const queue: FieldRef[] = [field];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.schemaId}:${current.column}`;
      if (visited.has(key)) continue;
      visited.add(key);

      for (const l of this.lineages) {
        if (l.target.schemaId === current.schemaId && l.target.column === current.column) {
          result.push(l);
          for (const src of l.sources) queue.push(src);
        }
      }
    }
    return result;
  }

  /** 특정 필드의 영향 추적 (순방향) */
  traceImpact(field: FieldRef): FieldLineage[] {
    const result: FieldLineage[] = [];
    const queue: FieldRef[] = [field];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.schemaId}:${current.column}`;
      if (visited.has(key)) continue;
      visited.add(key);

      for (const l of this.lineages) {
        if (l.sources.some(s => s.schemaId === current.schemaId && s.column === current.column)) {
          result.push(l);
          queue.push(l.target);
        }
      }
    }
    return result;
  }

  /** 특정 스키마의 모든 계보 */
  getSchemaLineage(schemaId: string): FieldLineage[] {
    return this.lineages.filter(
      l => l.target.schemaId === schemaId || l.sources.some(s => s.schemaId === schemaId),
    );
  }

  /** 전체 계보 */
  getAll(): readonly FieldLineage[] {
    return this.lineages;
  }
}

// ── 버전 수집 ─────────────────────────────────────────

export class VersionCollector {
  private readonly versions: Map<string, SchemaVersion[]> = new Map();

  /** 버전 기록 */
  record(version: SchemaVersion): void {
    const list = this.versions.get(version.schemaId) ?? [];
    list.push(version);
    this.versions.set(version.schemaId, list);
  }

  /** 특정 스키마의 전체 버전 이력 */
  getHistory(schemaId: string): SchemaVersion[] {
    return this.versions.get(schemaId) ?? [];
  }

  /** 특정 스키마의 breaking 변경 목록 */
  getBreakingChanges(schemaId: string): SchemaVersion[] {
    return this.getHistory(schemaId).filter(v => v.compatibility === "breaking");
  }

  /** 특정 스키마의 최신 버전 */
  getLatest(schemaId: string): SchemaVersion | null {
    const history = this.getHistory(schemaId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  /** 전체 스키마 목록 */
  listSchemas(): string[] {
    return [...this.versions.keys()];
  }
}
