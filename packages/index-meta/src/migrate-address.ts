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
import type { VersionedValue } from "./types.js";

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
