// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * migrate-address.ts — read-repair 기반 즉시 마이그레이션
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * DB에서 읽은 주소를 최신 버전으로 즉시 변환한다.
 * "나중에 일괄 마이그레이션"이 아니라, 값이 조회될 때 즉각 처리하는 패턴.
 *
 * ── 흐름 ───────────────────────────────────────────────────────────────────
 *
 *   DB read: "perm:v3:42"
 *     → parse → VV { v3, 42 }
 *     → v3 codec.decode → { role: "editor", action: "write" }
 *     → v4 codec.encode → VV { v4, ... }
 *     → serialize → "perm:v4:..."
 *   DB write: update with new address
 *
 * 이미 최신 버전이면 변환 없이 원본 반환.
 */

import type { MetaRegistry } from "./meta-registry.js";
import type { EntityId, VersionedValue } from "./types.js";

export interface MigrateResult {
  /** 변환된 주소 문자열 */
  serialized: string;
  /** 변환된 VersionedValue */
  vv: VersionedValue;
  /** 실제 마이그레이션이 발생했는지 (이미 최신이면 false) */
  migrated: boolean;
}

/**
 * 직렬화된 주소를 targetVersion으로 즉시 마이그레이션한다.
 *
 * 이미 targetVersion이면 변환 없이 반환한다.
 * entity ID가 targetVersion에 존재하지 않으면 에러가 발생한다.
 *
 * @example
 * const result = migrateAddress(reg, "perm:v3:42", "v4");
 * if (result.migrated) {
 *   await db.update(id, result.serialized);  // DB에 즉시 반영
 * }
 */
export function migrateAddress(
  registry: MetaRegistry,
  serialized: string,
  targetVersion: string,
  protocol?: string,
): MigrateResult {
  const vv = registry.parse(serialized, protocol);

  if (vv.versionId === targetVersion) {
    return { serialized, vv, migrated: false };
  }

  const source = registry.createCodec(vv.indexId, vv.versionId);
  const target = registry.createCodec(vv.indexId, targetVersion);
  const entityIds = source.decode(vv);
  const newVV = target.encode(entityIds);

  return {
    serialized: registry.serialize(newVV, protocol),
    vv: newVV,
    migrated: true,
  };
}

/**
 * VersionedValue를 targetVersion으로 즉시 마이그레이션한다.
 *
 * 직렬화/파싱 없이 VersionedValue 수준에서 동작.
 *
 * @example
 * const result = migrateValue(reg, vv, "v4");
 * if (result.migrated) {
 *   await db.update(id, result.vv);
 * }
 */
export function migrateValue(
  registry: MetaRegistry,
  vv: VersionedValue,
  targetVersion: string,
): Omit<MigrateResult, "serialized"> {
  if (vv.versionId === targetVersion) {
    return { vv, migrated: false };
  }

  const source = registry.createCodec(vv.indexId, vv.versionId);
  const target = registry.createCodec(vv.indexId, targetVersion);
  const entityIds = source.decode(vv);
  const newVV = target.encode(entityIds);

  return { vv: newVV, migrated: true };
}

// ── Cross-index 마이그레이션 ────────────────────────────────────────────────────

/**
 * target index의 dims 중 source에 없어 값 제공이 필요한 dim들을 나타낸다.
 *
 * - carryOverEntityIds: source에서 decode해 target dims와 겹치는 값들
 * - missingDimIds: target에만 있는 새 dim IDs — 값 제공 필요
 */
export interface CrossIndexPartialResult {
  readonly carryOverEntityIds: Readonly<Record<string, EntityId>>;
  readonly missingDimIds: readonly string[];
  readonly targetIndexId: string;
  readonly targetVersionId: string;
}

export type CrossIndexMigrateResult =
  | { readonly complete: true; readonly vv: VersionedValue; readonly migrated: boolean }
  | { readonly complete: false; readonly partial: CrossIndexPartialResult };

/**
 * 다른 index(혹은 동일 index의 다른 버전)로 크로스 마이그레이션한다.
 *
 * source dims와 target dims가 겹치는 값은 자동으로 carry-over한다.
 * target에만 있는 새 dim 값은 additionalEntityIds로 제공할 수 있다.
 *
 * - 모든 target dim이 확정되면 { complete: true, vv, migrated } 반환
 * - 누락된 dim이 있으면 { complete: false, partial } 반환
 *
 * @example
 * // perm:v1 (dims: role, action) → perm_v2:v1 (dims: role, action, resource)
 * const result = migrateCrossIndex(reg, vv, "perm_v2", "v1");
 * if (!result.complete) {
 *   // result.partial.missingDimIds === ["resource"]
 *   const done = migrateCrossIndex(reg, vv, "perm_v2", "v1", { resource: someId });
 * }
 */
export function migrateCrossIndex(
  registry: MetaRegistry,
  vv: VersionedValue,
  targetIndexId: string,
  targetVersionId: string,
  additionalEntityIds?: Record<string, EntityId>,
): CrossIndexMigrateResult {
  if (vv.indexId === targetIndexId && vv.versionId === targetVersionId) {
    return { complete: true, vv, migrated: false };
  }

  const sourceCodec = registry.createCodec(vv.indexId, vv.versionId);
  const sourceEntityIds = sourceCodec.decode(vv);

  const targetDef = registry.getIndexDef(targetIndexId);
  const carryOverEntityIds: Record<string, EntityId> = {};
  const missingDimIds: string[] = [];

  for (const dimId of targetDef.dims) {
    if (sourceEntityIds[dimId] !== undefined) {
      carryOverEntityIds[dimId] = sourceEntityIds[dimId];
    } else if (additionalEntityIds?.[dimId] !== undefined) {
      carryOverEntityIds[dimId] = additionalEntityIds[dimId];
    } else {
      missingDimIds.push(dimId);
    }
  }

  if (missingDimIds.length > 0) {
    return {
      complete: false,
      partial: {
        carryOverEntityIds: Object.freeze(carryOverEntityIds),
        missingDimIds: Object.freeze(missingDimIds) as readonly string[],
        targetIndexId,
        targetVersionId,
      },
    };
  }

  const targetCodec = registry.createCodec(targetIndexId, targetVersionId);
  const newVV = targetCodec.encode(carryOverEntityIds);
  return { complete: true, vv: newVV, migrated: true };
}

/**
 * CrossIndexPartialResult에 누락 dim 값을 보완해 encode를 완성한다.
 *
 * @example
 * const partial = (migrateCrossIndex(reg, vv, "perm_v2", "v1") as { complete: false; partial: CrossIndexPartialResult }).partial;
 * const newVV = completeCrossIndex(reg, partial, { resource: someId });
 */
export function completeCrossIndex(
  registry: MetaRegistry,
  partial: CrossIndexPartialResult,
  additionalEntityIds: Record<string, EntityId>,
): VersionedValue {
  const entityIds = { ...partial.carryOverEntityIds, ...additionalEntityIds };
  const codec = registry.createCodec(partial.targetIndexId, partial.targetVersionId);
  return codec.encode(entityIds);
}

/**
 * 주소 배열을 일괄 마이그레이션한다.
 *
 * 이미 최신인 항목은 건너뛴다. 변환된 항목만 migrated에 포함.
 *
 * @example
 * const results = migrateBatch(reg, addresses, "v4");
 * const updates = results.filter(r => r.migrated);
 * await db.batchUpdate(updates.map(r => ({ old: r.original, new: r.serialized })));
 */
export function migrateBatch(
  registry: MetaRegistry,
  addresses: string[],
  targetVersion: string,
  protocol?: string,
): Array<MigrateResult & { original: string }> {
  return addresses.map((addr) => ({
    original: addr,
    ...migrateAddress(registry, addr, targetVersion, protocol),
  }));
}
