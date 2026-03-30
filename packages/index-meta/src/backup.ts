import type { PrefixRegistry, PrefixRegistryRecord } from "./prefix-registry.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import { ValidationError } from "./errors.js";
import type { EntityId } from "./types.js";

// ── 백업 포맷 ─────────────────────────────────────────────

/**
 * versionId 단위 백업 파일 포맷.
 *
 * 하나의 JSON = 하나의 (prefix, versionId) 스냅샷.
 * composite 테이블은 sparse entries 대신 refs를 통해 의존 DAG를 복원한다.
 *
 * 복원 순서:
 *   1. PrefixRegistry에 { prefix, versionId, capacity, refs? } 등록
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
  refs?: PrefixRegistryRecord["refs"];

  /**
   * position → value (sparse).
   * 빈 position은 생략된다.
   * 값은 string_enum / reserved token / number_enum / index_ref를 그대로 보존한다.
   * composite 테이블은 빈 객체 {}.
   */
  entries: Record<string, EntityId>; // key = position(1-based) as string
}

// ── export ────────────────────────────────────────────────

/**
 * (prefix, versionId) 단위로 백업 JSON을 생성한다.
 *
 * PrefixRegistry에서 capacity를 읽고,
 * IndexMetaStore에서 entries를 읽어 VersionBackup을 구성한다.
 *
 * This function is read-only — it performs no writes to either
 * the PrefixRegistry or the IndexMetaStore. If an error occurs at
 * any point (e.g., network timeout, missing registry entry), there
 * are no side effects and no cleanup is needed.
 */
export async function exportVersion(
  prefix: string,
  versionId: string,
  registry: PrefixRegistry,
  store: IndexMetaStore,
  exportedAt = new Date().toISOString()
): Promise<VersionBackup> {
  const record = await registry.getRecord(prefix, versionId);
  if (record === null) {
    throw new ValidationError(
      `exportVersion: "${prefix}/${versionId}" not found in PrefixRegistry`
    );
  }

  const entryRecords = await store.getEntries(prefix, versionId);
  const entries: Record<string, EntityId> = {};
  for (const r of entryRecords) {
    entries[String(r.position)] = r.value;
  }

  return {
    format: "index-meta/v1",
    exportedAt,
    prefix,
    versionId,
    capacity: record.capacity,
    ...(record.refs ? { refs: record.refs.map((ref) => Object.assign({}, ref)) } : {}),
    entries,
  };
}

// ── import ────────────────────────────────────────────────

/**
 * VersionBackup JSON을 복원한다.
 *
 * 복원 순서:
 *   1. PrefixRegistry.register()  — capacity / refs 등록
 *   2. IndexMetaStore.insertSchemaVersion() — schema_version 등록
 *   3. entries → IndexMetaStore.insertEntry() 일괄 적재
 *
 * createdAt은 백업의 exportedAt을 사용한다.
 *
 * ## Partial failure semantics
 *
 * This operation is NOT atomic across the three steps above.
 * If a later step fails after earlier steps have succeeded,
 * there is no automatic rollback:
 *
 * - Step 1 failure: No side effects (nothing was written yet).
 * - Step 2 failure: PrefixRegistry retains the registered entry
 *   from step 1, but no schema_version or entries exist in the store.
 * - Step 3 failure (mid-entry): PrefixRegistry and schema_version
 *   are committed. Some entries may have been inserted while others
 *   have not — the store is left in an incomplete state.
 *
 * If the underlying IndexMetaStore implementation supports transactions
 * (e.g., SqlIndexMetaStore with SqlDriver.transaction), callers can wrap
 * the store operations in a transaction externally to achieve atomic import.
 *
 * Callers SHOULD handle partial failures and implement cleanup if needed
 * (e.g., delete the registered prefix and schema_version on rollback).
 */
export async function importVersion(
  backup: VersionBackup,
  registry: PrefixRegistry,
  store: IndexMetaStore
): Promise<void> {
  if (backup.format !== "index-meta/v1") {
    throw new ValidationError(
      `importVersion: unknown format "${(backup as { format: string }).format}"`
    );
  }

  // 1. PrefixRegistry 등록
  await registry.register({
    prefix: backup.prefix,
    versionId: backup.versionId,
    capacity: backup.capacity,
    ...(backup.refs ? { refs: backup.refs.map((ref) => ({ ...ref })) } : {}),
  });

  // 2. schema_version 등록
  await store.insertSchemaVersion({
    prefix:    backup.prefix,
    versionId: backup.versionId,
    capacity:  backup.capacity,
    createdAt: backup.exportedAt,
  });

  // 3. entries 적재
  for (const [posStr, value] of Object.entries(backup.entries)) {
    const position = Number(posStr);
    await store.insertEntry({
      prefix:    backup.prefix,
      versionId: backup.versionId,
      position,
      value,
      createdAt: backup.exportedAt,
    });
  }
}
