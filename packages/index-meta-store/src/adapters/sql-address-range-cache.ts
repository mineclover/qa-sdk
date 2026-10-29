// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlAddressRangeCache — 범용 SQLite 호환 AddressRangeCache 구현
 *
 * address_range_cache 테이블을 SqlDriver로 읽고 쓴다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 */

import type { AddressRangeCache, RangeCacheRecord } from 'index-meta';
import type { CoordConstraint } from 'weighted-index';
import type { SqlDriver } from './sql-store.js';

// ── DB row 타입 ───────────────────────────────────────────

interface RangeCacheRow extends Record<string, unknown> {
  prefix: string;
  version_id: string;
  label: string;
  ranges_json: string;
  constraints_json: string | null;
  computed_at: string;
}

// ── SqlAddressRangeCache ──────────────────────────────────

export class SqlAddressRangeCache implements AddressRangeCache {
  constructor(private readonly driver: SqlDriver) {}

  async save(record: RangeCacheRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO address_range_cache
         (prefix, version_id, label, ranges_json, constraints_json, computed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (prefix, version_id, label) DO UPDATE SET
         ranges_json = excluded.ranges_json,
         constraints_json = excluded.constraints_json,
         computed_at = excluded.computed_at`,
      [
        record.prefix,
        record.versionId,
        record.label,
        JSON.stringify(record.ranges),
        record.constraints ? JSON.stringify(record.constraints) : null,
        record.computedAt,
      ],
    );
  }

  async get(prefix: string, versionId: string, label: string): Promise<RangeCacheRecord | null> {
    const row = await this.driver.queryOne<RangeCacheRow>(
      `SELECT prefix, version_id, label, ranges_json, constraints_json, computed_at
       FROM address_range_cache WHERE prefix = ? AND version_id = ? AND label = ?`,
      [prefix, versionId, label],
    );
    return row ? toRecord(row) : null;
  }

  async list(prefix: string, versionId: string): Promise<RangeCacheRecord[]> {
    const rows = await this.driver.query<RangeCacheRow>(
      `SELECT prefix, version_id, label, ranges_json, constraints_json, computed_at
       FROM address_range_cache WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId],
    );
    return rows.map(toRecord);
  }

  async delete(prefix: string, versionId: string, label: string): Promise<void> {
    await this.driver.execute(
      `DELETE FROM address_range_cache WHERE prefix = ? AND version_id = ? AND label = ?`,
      [prefix, versionId, label],
    );
  }

  async deleteAll(prefix: string, versionId: string): Promise<void> {
    await this.driver.execute(
      `DELETE FROM address_range_cache WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId],
    );
  }
}

// ── 변환 헬퍼 ─────────────────────────────────────────────

function toRecord(row: RangeCacheRow): RangeCacheRecord {
  return {
    prefix: row.prefix,
    versionId: row.version_id,
    label: row.label,
    ranges: JSON.parse(row.ranges_json) as [number, number][],
    constraints: row.constraints_json
      ? (JSON.parse(row.constraints_json) as CoordConstraint[])
      : undefined,
    computedAt: row.computed_at,
  };
}
