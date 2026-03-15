/**
 * SqlEntryFlagStore — entry 수준 상태 이력의 SQL 구현
 *
 * entry_flag 테이블을 append-only로 사용한다.
 * 현재 상태 = (prefix, version_id, position) 기준 updated_at 최신 row.
 */

import type { EntryFlagStore, EntryFlagRecord } from "../entry-flag-store.js";
import type { SqlDriver } from "./sql-store.js";

interface EntryFlagRow extends Record<string, unknown> {
  prefix:     string;
  version_id: string;
  position:   number;
  status:     string;
  reason:     string | null;
  updated_at: string;
}

export class SqlEntryFlagStore implements EntryFlagStore {
  constructor(private readonly driver: SqlDriver) {}

  async setFlag(record: EntryFlagRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO entry_flag (prefix, version_id, position, status, reason, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [record.prefix, record.versionId, record.position, record.status, record.reason ?? null, record.updatedAt]
    );
  }

  async getFlag(prefix: string, versionId: string, position: number): Promise<EntryFlagRecord | null> {
    const row = await this.driver.queryOne<EntryFlagRow>(
      `SELECT prefix, version_id, position, status, reason, updated_at
       FROM entry_flag
       WHERE prefix = ? AND version_id = ? AND position = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [prefix, versionId, position]
    );
    return row ? toRecord(row) : null;
  }

  async getFlags(prefix: string, versionId: string): Promise<EntryFlagRecord[]> {
    // Get latest flag per position using a subquery
    const rows = await this.driver.query<EntryFlagRow>(
      `SELECT f.prefix, f.version_id, f.position, f.status, f.reason, f.updated_at
       FROM entry_flag f
       INNER JOIN (
         SELECT position, MAX(updated_at) AS max_at
         FROM entry_flag
         WHERE prefix = ? AND version_id = ?
         GROUP BY position
       ) latest ON f.position = latest.position AND f.updated_at = latest.max_at
       WHERE f.prefix = ? AND f.version_id = ?
       ORDER BY f.position ASC`,
      [prefix, versionId, prefix, versionId]
    );
    return rows.map(toRecord);
  }

  async getInactivePositions(prefix: string, versionId: string): Promise<number[]> {
    const flags = await this.getFlags(prefix, versionId);
    return flags
      .filter((f) => f.status === "inactive")
      .map((f) => f.position);
  }
}

function toRecord(row: EntryFlagRow): EntryFlagRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    position:  row.position,
    status:    row.status as "active" | "inactive",
    reason:    row.reason ?? undefined,
    updatedAt: row.updated_at,
  };
}
