// @def.boundary index-meta-system
// @def.doc index-meta-system

import type { EntityId } from './types.js';

// ── Record 타입 ───────────────────────────────────────────

export interface SchemaVersionRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly capacity: number;
  readonly createdAt: string; // ISO 8601
}

export interface EntryRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly position: number; // 1-based
  readonly value: EntityId;
  readonly createdAt: string; // ISO 8601
}

// ── IndexMetaStore 인터페이스 ─────────────────────────────

export interface IndexMetaStore {
  // ── schema_version ─────────────────────────────────────

  /** 버전 메타 저장. 중복 (prefix, versionId)는 에러. */
  insertSchemaVersion(record: SchemaVersionRecord): Promise<void>;

  /** 테이블의 모든 버전 목록. createdAt 오름차순. */
  getSchemaVersions(prefix: string): Promise<SchemaVersionRecord[]>;

  /** 특정 버전 조회. 없으면 null. */
  getSchemaVersion(prefix: string, versionId: string): Promise<SchemaVersionRecord | null>;

  /**
   * 특정 버전의 capacity만 반환. WeightedIndex shape 계산 전용 fast-path.
   * schema_version 레코드 전체를 읽지 않고 capacity만 추출한다.
   * 버전이 없으면 null.
   */
  getCapacity(prefix: string, versionId: string): Promise<number | null>;

  // ── entry ───────────────────────────────────────────────

  /** entry 저장. capacity 범위 초과 또는 중복 position은 에러. */
  insertEntry(record: EntryRecord): Promise<void>;

  /** 특정 버전의 모든 entry. position 오름차순. */
  getEntries(prefix: string, versionId: string): Promise<EntryRecord[]>;

  /**
   * position 범위 [from, to] (inclusive) 내의 entry 목록. position 오름차순.
   * WeightedIndex가 계산한 주소 범위로 entries를 부분 조회할 때 사용.
   * 채워지지 않은 position은 결과에 포함되지 않는다 (sparse).
   */
  getEntriesInRange(
    prefix: string,
    versionId: string,
    from: number,
    to: number,
  ): Promise<EntryRecord[]>;

  /** 특정 position의 entry 조회. 없으면 null. */
  getEntry(prefix: string, versionId: string, position: number): Promise<EntryRecord | null>;

  /**
   * Reverse lookup: find entry by value. null if not found.
   * Used in address path (label → position).
   */
  getEntryByValue(prefix: string, versionId: string, value: EntityId): Promise<EntryRecord | null>;

  /**
   * fromVersion의 entry를 positionMap에 따라 toVersion으로 일괄 복사.
   *
   * positionMap: fromVersion의 1-based position → toVersion의 1-based position.
   * 명시 없는 position은 동일 position 유지 (identity).
   * toVersion에 이미 해당 position이 존재하면 건너뜀 (idempotent).
   * toVersion의 schema_version이 없으면 에러.
   *
   * Implementations MUST execute this method atomically.
   * Partial application is not allowed.
   * If any entry insert fails, the entire operation MUST be rolled back
   * so that no entries are written to toVersion.
   *
   * @returns migrated — 실제 삽입된 수, skipped — 이미 존재해 건너뛴 수
   */
  migrateEntries(
    prefix: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>,
  ): Promise<{ migrated: number; skipped: number }>;
}
