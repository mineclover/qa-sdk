// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlAddressStateStore — 범용 SQLite 호환 AddressStateStore 구현
 *
 * address_state_cache 테이블을 SqlDriver로 읽고 쓴다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 */

import type { AddressStateStore, AddressStateCacheRecord } from 'index-meta';
import type { DimStateSpec } from 'index-meta';
import type { SqlDriver } from './sql-store.js';

// ── DB row 타입 ───────────────────────────────────────────

interface AddressStateCacheRow extends Record<string, unknown> {
  prefix: string;
  version_id: string;
  specs_json: string;
  reserved_json: string;
  inactive_json: string;
  open_json: string;
  computed_at: string;
}

// ── SqlAddressStateStore ──────────────────────────────────

export class SqlAddressStateStore implements AddressStateStore {
  constructor(private readonly driver: SqlDriver) {}

  async save(record: AddressStateCacheRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO address_state_cache
         (prefix, version_id, specs_json, reserved_json, inactive_json, open_json, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (prefix, version_id) DO UPDATE SET
         specs_json = excluded.specs_json,
         reserved_json = excluded.reserved_json,
         inactive_json = excluded.inactive_json,
         open_json = excluded.open_json,
         computed_at = excluded.computed_at`,
      [
        record.prefix,
        record.versionId,
        JSON.stringify(record.specs),
        JSON.stringify(record.reservedRanges),
        JSON.stringify(record.inactiveRanges),
        JSON.stringify(record.openRanges),
        record.computedAt,
      ],
    );
  }

  async get(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null> {
    const row = await this.driver.queryOne<AddressStateCacheRow>(
      `SELECT prefix, version_id, specs_json, reserved_json, inactive_json, open_json, computed_at
       FROM address_state_cache WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId],
    );
    return row ? toRecord(row) : null;
  }

  async delete(prefix: string, versionId: string): Promise<void> {
    await this.driver.execute(
      `DELETE FROM address_state_cache WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId],
    );
  }
}

// ── 변환 헬퍼 ─────────────────────────────────────────────

function toRecord(row: AddressStateCacheRow): AddressStateCacheRecord {
  return {
    prefix: row.prefix,
    versionId: row.version_id,
    specs: JSON.parse(row.specs_json) as DimStateSpec[],
    reservedRanges: JSON.parse(row.reserved_json) as [number, number][],
    inactiveRanges: JSON.parse(row.inactive_json) as [number, number][],
    openRanges: JSON.parse(row.open_json) as [number, number][],
    computedAt: row.computed_at,
  };
}
