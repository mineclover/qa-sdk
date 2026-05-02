// @def.boundary index-meta-system
// @def.doc index-meta-system

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
          `INSERT INTO schema_version (prefix, version_id, capacity, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .bind(record.prefix, record.versionId, record.capacity, record.createdAt)
        .run();
    } catch (err) {
      throw new IndexMetaError(
        `D1 insertSchemaVersion failed for "${record.prefix}/${record.versionId}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getSchemaVersions(prefix: string): Promise<SchemaVersionRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT prefix, version_id, capacity, created_at
         FROM schema_version WHERE prefix = ?
         ORDER BY created_at ASC`
      )
      .bind(prefix)
      .all<{ prefix: string; version_id: string; capacity: number; created_at: string }>();

    return result.results.map(toSchemaVersionRecord);
  }

  async getSchemaVersion(prefix: string, versionId: string): Promise<SchemaVersionRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT prefix, version_id, capacity, created_at
         FROM schema_version WHERE prefix = ? AND version_id = ?`
      )
      .bind(prefix, versionId)
      .first<{ prefix: string; version_id: string; capacity: number; created_at: string }>();

    return row ? toSchemaVersionRecord(row) : null;
  }

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    const row = await this.db
      .prepare(`SELECT capacity FROM schema_version WHERE prefix = ? AND version_id = ?`)
      .bind(prefix, versionId)
      .first<{ capacity: number }>();

    return row?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const [sv, existing] = await Promise.all([
      this.getSchemaVersion(record.prefix, record.versionId),
      this.getEntry(record.prefix, record.versionId, record.position),
    ]);

    validateEntryForInsert(record, sv, existing);

    try {
      await this.db
        .prepare(
          `INSERT INTO entry (prefix, version_id, position, value, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(record.prefix, record.versionId, record.position, String(record.value), record.createdAt)
        .run();
    } catch (err) {
      throw new IndexMetaError(
        `D1 insertEntry failed for "${record.prefix}/${record.versionId}" position ${record.position}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getEntries(prefix: string, versionId: string): Promise<EntryRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT prefix, version_id, position, value, created_at
         FROM entry WHERE prefix = ? AND version_id = ?
         ORDER BY position ASC`
      )
      .bind(prefix, versionId)
      .all<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>();

    return result.results.map(toEntryRecord);
  }

  async getEntriesInRange(
    prefix: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT prefix, version_id, position, value, created_at
         FROM entry
         WHERE prefix = ? AND version_id = ? AND position >= ? AND position <= ?
         ORDER BY position ASC`
      )
      .bind(prefix, versionId, from, to)
      .all<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>();

    return result.results.map(toEntryRecord);
  }

  async getEntry(prefix: string, versionId: string, position: number): Promise<EntryRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT prefix, version_id, position, value, created_at
         FROM entry WHERE prefix = ? AND version_id = ? AND position = ?`
      )
      .bind(prefix, versionId, position)
      .first<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>();

    return row ? toEntryRecord(row) : null;
  }

  async getEntryByValue(prefix: string, versionId: string, value: EntityId): Promise<EntryRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT prefix, version_id, position, value, created_at
         FROM entry WHERE prefix = ? AND version_id = ? AND value = ?`
      )
      .bind(prefix, versionId, String(value))
      .first<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>();

    return row ? toEntryRecord(row) : null;
  }

  async migrateEntries(
    prefix: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>
  ): Promise<{ migrated: number; skipped: number }> {
    const sv = await this.getSchemaVersion(prefix, toVersion);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${prefix}/${toVersion}". Insert schema version first.`
      );
    }

    // D1 does not support multi-statement transactions via the Workers API.
    // Operations are individually atomic. migrateEntries runs without transaction wrapping.
    let sourceResult: D1Result<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>;
    let existingResult: D1Result<{ position: number }>;
    try {
      [sourceResult, existingResult] = await Promise.all([
        this.db
          .prepare(`SELECT prefix, version_id, position, value, created_at FROM entry WHERE prefix = ? AND version_id = ? ORDER BY position ASC`)
          .bind(prefix, fromVersion)
          .all<{ prefix: string; version_id: string; position: number; value: string; created_at: string }>(),
        this.db
          .prepare(`SELECT position FROM entry WHERE prefix = ? AND version_id = ?`)
          .bind(prefix, toVersion)
          .all<{ position: number }>(),
      ]);
    } catch (err) {
      throw new IndexMetaError(
        `D1 migrateEntries failed to read entries for "${prefix}" (${fromVersion} -> ${toVersion}): ${err instanceof Error ? err.message : String(err)}`
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
          `Mapped position ${newPosition} out of range [1, ${sv.capacity}] for "${prefix}/${toVersion}"`
        );
      }
      try {
        await this.db
          .prepare(`INSERT INTO entry (prefix, version_id, position, value, created_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(prefix, toVersion, newPosition, String(entry.value), now)
          .run();
      } catch (err) {
        throw new IndexMetaError(
          `D1 migrateEntries failed to insert position ${newPosition} for "${prefix}/${toVersion}": ${err instanceof Error ? err.message : String(err)}`
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
  prefix: string;
  version_id: string;
  capacity: number;
  created_at: string;
}): SchemaVersionRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    capacity:  row.capacity,
    createdAt: row.created_at,
  };
}

function toEntryRecord(row: {
  prefix: string;
  version_id: string;
  position: number;
  value: string;
  created_at: string;
}): EntryRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    position:  row.position,
    value:     row.value,
    createdAt: row.created_at,
  };
}
