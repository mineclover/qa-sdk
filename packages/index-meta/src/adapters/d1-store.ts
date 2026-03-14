/**
 * D1IndexMetaStore — Cloudflare D1 어댑터
 *
 * IndexMetaStore 인터페이스를 Cloudflare D1 바인딩으로 구현한다.
 * d1-schema.sql이 먼저 적용된 D1 인스턴스가 필요하다.
 */

import type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "../index-meta-store.js";
import { ValidationError } from "../errors.js";
import type { EntityId } from "../types.js";

// ── Cloudflare D1 최소 타입 정의 ─────────────────────────
// @cloudflare/workers-types 없이도 동작하도록 로컬 정의

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

// ── D1IndexMetaStore ──────────────────────────────────────

export class D1IndexMetaStore implements IndexMetaStore {
  constructor(private readonly db: D1Database) {}

  // ── schema_version ──────────────────────────────────────

  async insertSchemaVersion(record: SchemaVersionRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO schema_version (table_id, version_id, capacity, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(record.tableId, record.versionId, record.capacity, record.createdAt)
      .run();
  }

  async getSchemaVersions(tableId: string): Promise<SchemaVersionRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT table_id, version_id, capacity, created_at
         FROM schema_version WHERE table_id = ?
         ORDER BY created_at ASC`
      )
      .bind(tableId)
      .all<{ table_id: string; version_id: string; capacity: number; created_at: string }>();

    return result.results.map(toSchemaVersionRecord);
  }

  async getSchemaVersion(tableId: string, versionId: string): Promise<SchemaVersionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT table_id, version_id, capacity, created_at
         FROM schema_version WHERE table_id = ? AND version_id = ?`
      )
      .bind(tableId, versionId)
      .first<{ table_id: string; version_id: string; capacity: number; created_at: string }>();

    return row ? toSchemaVersionRecord(row) : null;
  }

  async getCapacity(tableId: string, versionId: string): Promise<number | null> {
    const row = await this.db
      .prepare(`SELECT capacity FROM schema_version WHERE table_id = ? AND version_id = ?`)
      .bind(tableId, versionId)
      .first<{ capacity: number }>();

    return row?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const sv = await this.getSchemaVersion(record.tableId, record.versionId);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${record.tableId}/${record.versionId}"`
      );
    }
    if (record.position < 1 || record.position > sv.capacity) {
      throw new ValidationError(
        `Position ${record.position} out of range [1, ${sv.capacity}]`
      );
    }

    await this.db
      .prepare(
        `INSERT INTO entry (table_id, version_id, position, value, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(record.tableId, record.versionId, record.position, String(record.value), record.createdAt)
      .run();
  }

  async getEntries(tableId: string, versionId: string): Promise<EntryRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT table_id, version_id, position, value, created_at
         FROM entry WHERE table_id = ? AND version_id = ?
         ORDER BY position ASC`
      )
      .bind(tableId, versionId)
      .all<{ table_id: string; version_id: string; position: number; value: string; created_at: string }>();

    return result.results.map(toEntryRecord);
  }

  async getEntriesInRange(
    tableId: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT table_id, version_id, position, value, created_at
         FROM entry
         WHERE table_id = ? AND version_id = ? AND position >= ? AND position <= ?
         ORDER BY position ASC`
      )
      .bind(tableId, versionId, from, to)
      .all<{ table_id: string; version_id: string; position: number; value: string; created_at: string }>();

    return result.results.map(toEntryRecord);
  }

  async getEntry(tableId: string, versionId: string, position: number): Promise<EntryRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT table_id, version_id, position, value, created_at
         FROM entry WHERE table_id = ? AND version_id = ? AND position = ?`
      )
      .bind(tableId, versionId, position)
      .first<{ table_id: string; version_id: string; position: number; value: string; created_at: string }>();

    return row ? toEntryRecord(row) : null;
  }
}

// ── 변환 헬퍼 ─────────────────────────────────────────────

function toSchemaVersionRecord(row: {
  table_id: string;
  version_id: string;
  capacity: number;
  created_at: string;
}): SchemaVersionRecord {
  return {
    tableId:   row.table_id,
    versionId: row.version_id,
    capacity:  row.capacity,
    createdAt: row.created_at,
  };
}

function toEntryRecord(row: {
  table_id: string;
  version_id: string;
  position: number;
  value: string;
  created_at: string;
}): EntryRecord {
  return {
    tableId:   row.table_id,
    versionId: row.version_id,
    position:  row.position,
    value:     row.value,
    createdAt: row.created_at,
  };
}
