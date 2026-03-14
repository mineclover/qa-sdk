import type { PrefixRegistry, PrefixRegistryRecord } from "./prefix-registry.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import { ValidationError } from "./errors.js";

// ── 백업 포맷 ─────────────────────────────────────────────

/**
 * versionId 단위 백업 파일 포맷.
 *
 * 하나의 JSON = 하나의 (prefix, versionId) 스냅샷.
 * composite 테이블은 entries가 없으므로 entries 필드가 비어있다.
 *
 * 복원 순서:
 *   1. PrefixRegistry에 { prefix, versionId, capacity } 등록
 *   2. IndexMetaStore에 schema_version 등록
 *   3. entries를 IndexMetaStore에 적재
 */
export interface VersionBackup {
  /** 포맷 식별자 — 파싱 호환성 검증용 */
  format: "index-meta/v1";
  exportedAt: string;  // ISO 8601

  prefix: string;
  versionId: string;
  capacity: number;

  /**
   * position → value (sparse).
   * 빈 position은 생략.
   * 예약 마커도 동일하게 포함: { "4": "_", "140": "NaN" }
   * composite 테이블은 빈 객체 {}.
   */
  entries: Record<string, string>; // key = position(1-based) as string
}

// ── export ────────────────────────────────────────────────

/**
 * (prefix, versionId) 단위로 백업 JSON을 생성한다.
 *
 * PrefixRegistry에서 capacity를 읽고,
 * IndexMetaStore에서 entries를 읽어 VersionBackup을 구성한다.
 */
export async function exportVersion(
  prefix: string,
  versionId: string,
  registry: PrefixRegistry,
  store: IndexMetaStore,
  exportedAt = new Date().toISOString()
): Promise<VersionBackup> {
  const capacity = await registry.getCapacity(prefix, versionId);
  if (capacity === null) {
    throw new ValidationError(
      `exportVersion: "${prefix}/${versionId}" not found in PrefixRegistry`
    );
  }

  const entryRecords = await store.getEntries(prefix, versionId);
  const entries: Record<string, string> = {};
  for (const r of entryRecords) {
    entries[String(r.position)] = String(r.value);
  }

  return {
    format: "index-meta/v1",
    exportedAt,
    prefix,
    versionId,
    capacity,
    entries,
  };
}

// ── import ────────────────────────────────────────────────

/**
 * VersionBackup JSON을 복원한다.
 *
 * 복원 순서:
 *   1. PrefixRegistry.register()  — capacity 등록
 *   2. IndexMetaStore.insertSchemaVersion() — schema_version 등록
 *   3. entries → IndexMetaStore.insertEntry() 일괄 적재
 *
 * createdAt은 백업의 exportedAt을 사용한다.
 */
export async function importVersion(
  backup: VersionBackup,
  registry: PrefixRegistry,
  store: IndexMetaStore
): Promise<void> {
  if (backup.format !== "index-meta/v1") {
    throw new ValidationError(
      `importVersion: unknown format "${(backup as any).format}"`
    );
  }

  // 1. PrefixRegistry 등록
  await registry.register({
    prefix: backup.prefix,
    versionId: backup.versionId,
    capacity: backup.capacity,
  });

  // 2. schema_version 등록
  await store.insertSchemaVersion({
    tableId:   backup.prefix,
    versionId: backup.versionId,
    capacity:  backup.capacity,
    createdAt: backup.exportedAt,
  });

  // 3. entries 적재
  for (const [posStr, value] of Object.entries(backup.entries)) {
    const position = Number(posStr);
    await store.insertEntry({
      tableId:   backup.prefix,
      versionId: backup.versionId,
      position,
      value,
      createdAt: backup.exportedAt,
    });
  }
}
