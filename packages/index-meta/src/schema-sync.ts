// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * schema-sync — compileSchema 결과를 PrefixRegistry에 동기화
 *
 * compileSchema()가 계산한 CompiledSchema를 PrefixRegistry에 등록한다.
 * TableDef의 DAG 구조(composite refs)가 PrefixRegistryRecord.refs로 영속화된다.
 *
 * 이후 "perm:v1:1345" 같은 SemanticAddress를 PrefixRegistry만으로
 * 완전히 복원할 수 있게 된다.
 */

import type { CompiledSchema, SchemaDiff, CompositeVersionSpec } from "./compile-schema.js";
import type { PrefixRegistry, PrefixRegistryRecord, DimRef } from "./prefix-registry.js";

/**
 * CompiledSchema → PrefixRegistry 일괄 등록.
 *
 * - leaf:      { prefix, versionId, capacity } 만 등록.
 * - composite: { prefix, versionId, capacity, refs } 등록.
 *              refs = 각 dim의 { prefix, versionId, capacity }.
 *
 * 이미 등록된 (prefix, versionId)는 건너뛴다 (idempotent).
 */
export async function syncSchemaToRegistry(
  schema: CompiledSchema,
  registry: PrefixRegistry
): Promise<void> {
  for (const table of schema.tables) {
    for (const [, version] of table.versions) {
      const existing = await registry.getCapacity(table.id, version.versionId);
      if (existing !== null) continue; // 이미 등록됨

      const record: PrefixRegistryRecord =
        table.kind === "leaf"
          ? {
              prefix:    table.id,
              versionId: version.versionId,
              capacity:  version.capacity,
            }
          : {
              prefix:    table.id,
              versionId: version.versionId,
              capacity:  version.capacity,
              refs: (version as import("./compile-schema.js").CompositeVersionSpec).dims.map(
                (dim): DimRef => ({
                  prefix:    dim.ref.prefix,
                  versionId: dim.ref.version,
                  capacity:  dim.ref.capacity,
                })
              ),
            };

      await registry.register(record);
    }
  }
}

// ── SchemaDiff 적용 결과 ──────────────────────────────────

export interface ApplySchemaDiffResult {
  /** 신규 등록된 (prefix, versionId) 목록 */
  readonly registered: readonly { prefix: string; versionId: string }[];
  /** capacity가 갱신된 (prefix, versionId) 목록 */
  readonly updated: readonly { prefix: string; versionId: string; previousCapacity: number; capacity: number }[];
  /** 스키마에서 제거되었으나 레지스트리에서 삭제하지 않은 테이블 */
  readonly removedWarnings: readonly string[];
}

/**
 * SchemaDiff를 PrefixRegistry에 반영한다.
 *
 * - diff.added → 신규 테이블 등록 (syncSchemaToRegistry와 동일)
 * - diff.changed.addedVersions:
 *   - previousCapacity 있음 → updateCapacity (capacity headroom 확장)
 *   - previousCapacity 없음 → 신규 버전 등록
 * - diff.removed → 레지스트리에서 삭제하지 않고 경고 목록 반환
 *
 * composite의 경우 leaf capacity 변경이 cascade되므로,
 * compileSchema가 이미 재계산한 capacity를 그대로 사용한다.
 */
export async function applySchemaDiff(
  diff: SchemaDiff,
  newSchema: CompiledSchema,
  registry: PrefixRegistry,
): Promise<ApplySchemaDiffResult> {
  const registered: { prefix: string; versionId: string }[] = [];
  const updated: { prefix: string; versionId: string; previousCapacity: number; capacity: number }[] = [];

  // 1. 신규 테이블 등록
  for (const table of diff.added) {
    for (const [, version] of table.versions) {
      const record = buildRecord(table.id, table.kind, version);
      await registry.register(record);
      registered.push({ prefix: table.id, versionId: version.versionId });
    }
  }

  // 2. 변경된 테이블 처리
  for (const change of diff.changed) {
    const table = newSchema.getTable(change.tableId);
    if (!table) continue;

    for (const vc of change.addedVersions) {
      const version = table.versions.get(vc.versionId);
      if (!version) continue;

      if (vc.previousCapacity !== undefined) {
        // capacity 변경 → updateCapacity
        const refs = table.kind === "composite"
          ? (version as CompositeVersionSpec).dims.map(
              (dim): DimRef => ({
                prefix: dim.ref.prefix,
                versionId: dim.ref.version,
                capacity: dim.ref.capacity,
              })
            )
          : undefined;
        await registry.updateCapacity(table.id, vc.versionId, vc.capacity, refs);
        updated.push({
          prefix: table.id,
          versionId: vc.versionId,
          previousCapacity: vc.previousCapacity,
          capacity: vc.capacity,
        });
      } else {
        // 신규 버전 → register
        const record = buildRecord(table.id, table.kind, version);
        await registry.register(record);
        registered.push({ prefix: table.id, versionId: vc.versionId });
      }
    }
  }

  return {
    registered,
    updated,
    removedWarnings: [...diff.removed],
  };
}

function buildRecord(
  tableId: string,
  kind: "leaf" | "composite",
  version: { versionId: string; capacity: number },
): PrefixRegistryRecord {
  if (kind === "leaf") {
    return { prefix: tableId, versionId: version.versionId, capacity: version.capacity };
  }
  const cv = version as CompositeVersionSpec;
  return {
    prefix: tableId,
    versionId: version.versionId,
    capacity: version.capacity,
    refs: cv.dims.map(
      (dim): DimRef => ({
        prefix: dim.ref.prefix,
        versionId: dim.ref.version,
        capacity: dim.ref.capacity,
      })
    ),
  };
}
