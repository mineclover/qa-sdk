/**
 * D1IndexMetaStore — Cloudflare D1 어댑터
 *
 * IndexMetaStore 인터페이스를 Cloudflare D1 바인딩으로 구현한다.
 * d1-schema.sql이 먼저 적용된 D1 인스턴스가 필요하다.
 */

import type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "../index-meta-store.js";
import { IndexMetaError, ValidationError } from "../errors.js";
import type { EntityId } from "../types.js";
import { validateEntryForInsert } from "./validate-entry.js";

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
    try {
      await this.db
        .prepare(
          `INSERT INTO schema_version (table_id, version_id, capacity, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .bind(record.tableId, record.versionId, record.capacity, record.createdAt)
        .run();
    } catch (err) {
      throw new IndexMetaError(
        `D1 insertSchemaVersion failed for "${record.tableId}/${record.versionId}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
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
    const [sv, existing] = await Promise.all([
      this.getSchemaVersion(record.tableId, record.versionId),
      this.getEntry(record.tableId, record.versionId, record.position),
    ]);

    validateEntryForInsert(record, sv, existing);

    try {
      await this.db
        .prepare(
          `INSERT INTO entry (table_id, version_id, position, value, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(record.tableId, record.versionId, record.position, String(record.value), record.createdAt)
        .run();
    } catch (err) {
      throw new IndexMetaError(
        `D1 insertEntry failed for "${record.tableId}/${record.versionId}" position ${record.position}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
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

  async migrateEntries(
    tableId: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>
  ): Promise<{ migrated: number; skipped: number }> {
    const sv = await this.getSchemaVersion(tableId, toVersion);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${tableId}/${toVersion}". Insert schema version first.`
      );
    }

    let sourceResult: D1Result<{ table_id: string; version_id: string; position: number; value: string; created_at: string }>;
    let existingResult: D1Result<{ position: number }>;
    try {
      [sourceResult, existingResult] = await Promise.all([
        this.db
          .prepare(`SELECT table_id, version_id, position, value, created_at FROM entry WHERE table_id = ? AND version_id = ? ORDER BY position ASC`)
          .bind(tableId, fromVersion)
          .all<{ table_id: string; version_id: string; position: number; value: string; created_at: string }>(),
        this.db
          .prepare(`SELECT position FROM entry WHERE table_id = ? AND version_id = ?`)
          .bind(tableId, toVersion)
          .all<{ position: number }>(),
      ]);
    } catch (err) {
      throw new IndexMetaError(
        `D1 migrateEntries failed to read entries for "${tableId}" (${fromVersion} -> ${toVersion}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const sourceEntries = sourceResult.results.map(toEntryRecord);
    const existingPositions = new Set(existingResult.results.map((r) => r.position));

    const now = new Date().toISOString();
    let migrated = 0;
    let skipped = 0;

    for (const entry of sourceEntries) {
      const newPosition = positionMap?.[entry.position] ?? entry.position;
      if (existingPositions.has(newPosition)) {
        skipped++;
        continue;
      }
      if (newPosition < 1 || newPosition > sv.capacity) {
        throw new ValidationError(
          `Mapped position ${newPosition} out of range [1, ${sv.capacity}] for "${tableId}/${toVersion}"`
        );
      }
      try {
        await this.db
          .prepare(`INSERT INTO entry (table_id, version_id, position, value, created_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(tableId, toVersion, newPosition, String(entry.value), now)
          .run();
      } catch (err) {
        throw new IndexMetaError(
          `D1 migrateEntries failed to insert position ${newPosition} for "${tableId}/${toVersion}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
      existingPositions.add(newPosition);
      migrated++;
    }

    return { migrated, skipped };
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
