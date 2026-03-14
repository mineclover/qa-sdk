/**
 * SqlIndexMetaStore — 범용 SQLite 호환 어댑터
 *
 * IndexMetaStore 인터페이스를 SqlDriver로 구현한다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 *
 * SqlDriver를 구현하면 D1 / Turso / libsql / better-sqlite3 등
 * 어떤 SQLite 호환 DB에도 동작한다.
 */

import type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "../index-meta-store.js";
import { ValidationError } from "../errors.js";
import type { EntityId } from "../types.js";

// ── SqlDriver — 범용 SQL 드라이버 인터페이스 ─────────────────────────────────

/**
 * SQLite 호환 DB를 일관된 방식으로 사용하기 위한 최소 인터페이스.
 *
 * 구현 예:
 *   D1        → D1Database.prepare().bind().all() / first() / run()
 *   Turso     → LibsqlClient.execute()
 *   libsql    → Database.prepare().run() / all() / get()
 *   better-sqlite3 → Database.prepare().all() / get() / run()
 */
export interface SqlDriver {
  /**
   * 여러 행 반환 쿼리 (SELECT multiple).
   * 결과가 없으면 빈 배열.
   */
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;

  /**
   * 단일 행 반환 쿼리 (SELECT one).
   * 결과가 없으면 null.
   */
  queryOne<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null>;

  /**
   * 변경 쿼리 (INSERT / UPDATE / DELETE).
   */
  execute(sql: string, params?: unknown[]): Promise<void>;
}

// ── SqlIndexMetaStore ─────────────────────────────────────────────────────────

export class SqlIndexMetaStore implements IndexMetaStore {
  constructor(private readonly driver: SqlDriver) {}

  // ── schema_version ──────────────────────────────────────

  async insertSchemaVersion(record: SchemaVersionRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO schema_version (table_id, version_id, capacity, created_at)
       VALUES (?, ?, ?, ?)`,
      [record.tableId, record.versionId, record.capacity, record.createdAt]
    );
  }

  async getSchemaVersions(tableId: string): Promise<SchemaVersionRecord[]> {
    const rows = await this.driver.query<SchemaVersionRow>(
      `SELECT table_id, version_id, capacity, created_at
       FROM schema_version WHERE table_id = ?
       ORDER BY created_at ASC`,
      [tableId]
    );
    return rows.map(toSchemaVersionRecord);
  }

  async getSchemaVersion(
    tableId: string,
    versionId: string
  ): Promise<SchemaVersionRecord | null> {
    const row = await this.driver.queryOne<SchemaVersionRow>(
      `SELECT table_id, version_id, capacity, created_at
       FROM schema_version WHERE table_id = ? AND version_id = ?`,
      [tableId, versionId]
    );
    return row ? toSchemaVersionRecord(row) : null;
  }

  async getCapacity(tableId: string, versionId: string): Promise<number | null> {
    const row = await this.driver.queryOne<{ capacity: number }>(
      `SELECT capacity FROM schema_version WHERE table_id = ? AND version_id = ?`,
      [tableId, versionId]
    );
    return row?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const sv = await this.getSchemaVersion(record.tableId, record.versionId);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${record.tableId}/${record.versionId}". Insert schema version first.`
      );
    }
    if (record.position < 1 || record.position > sv.capacity) {
      throw new ValidationError(
        `Position ${record.position} out of range [1, ${sv.capacity}] for "${record.tableId}/${record.versionId}"`
      );
    }
    await this.driver.execute(
      `INSERT INTO entry (table_id, version_id, position, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.tableId, record.versionId, record.position, String(record.value), record.createdAt]
    );
  }

  async getEntries(tableId: string, versionId: string): Promise<EntryRecord[]> {
    const rows = await this.driver.query<EntryRow>(
      `SELECT table_id, version_id, position, value, created_at
       FROM entry WHERE table_id = ? AND version_id = ?
       ORDER BY position ASC`,
      [tableId, versionId]
    );
    return rows.map(toEntryRecord);
  }

  async getEntriesInRange(
    tableId: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    const rows = await this.driver.query<EntryRow>(
      `SELECT table_id, version_id, position, value, created_at
       FROM entry
       WHERE table_id = ? AND version_id = ? AND position >= ? AND position <= ?
       ORDER BY position ASC`,
      [tableId, versionId, from, to]
    );
    return rows.map(toEntryRecord);
  }

  async getEntry(
    tableId: string,
    versionId: string,
    position: number
  ): Promise<EntryRecord | null> {
    const row = await this.driver.queryOne<EntryRow>(
      `SELECT table_id, version_id, position, value, created_at
       FROM entry WHERE table_id = ? AND version_id = ? AND position = ?`,
      [tableId, versionId, position]
    );
    return row ? toEntryRecord(row) : null;
  }
}

// ── DB row 타입 + 변환 헬퍼 ──────────────────────────────────────────────────

interface SchemaVersionRow extends Record<string, unknown> {
  table_id: string;
  version_id: string;
  capacity: number;
  created_at: string;
}

interface EntryRow extends Record<string, unknown> {
  table_id: string;
  version_id: string;
  position: number;
  value: string;
  created_at: string;
}

function toSchemaVersionRecord(row: SchemaVersionRow): SchemaVersionRecord {
  return {
    tableId:   row.table_id,
    versionId: row.version_id,
    capacity:  row.capacity,
    createdAt: row.created_at,
  };
}

function toEntryRecord(row: EntryRow): EntryRecord {
  return {
    tableId:   row.table_id,
    versionId: row.version_id,
    position:  row.position,
    value:     row.value,
    createdAt: row.created_at,
  };
}
