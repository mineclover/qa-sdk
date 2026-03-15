/**
 * BetterSqliteDriver — better-sqlite3 기반 SqlDriver 구현
 *
 * 로컬 테스트 및 개발 환경에서 사용한다.
 * better-sqlite3는 동기 API이므로 Promise.resolve()로 래핑한다.
 */

import Database from "better-sqlite3";
import type { SqlDriver } from "./sql-store.js";

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS prefix_registry (
  prefix        TEXT    NOT NULL,
  version_id    TEXT    NOT NULL,
  capacity      INTEGER NOT NULL,
  registered_at TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

CREATE TABLE IF NOT EXISTS prefix_ref (
  parent_prefix     TEXT    NOT NULL,
  parent_version_id TEXT    NOT NULL,
  dim_order         INTEGER NOT NULL,
  ref_prefix        TEXT    NOT NULL,
  ref_version_id    TEXT    NOT NULL,
  ref_capacity      INTEGER NOT NULL,
  PRIMARY KEY (parent_prefix, parent_version_id, dim_order),
  FOREIGN KEY (parent_prefix, parent_version_id)
    REFERENCES prefix_registry(prefix, version_id)
);

CREATE TABLE IF NOT EXISTS schema_version (
  prefix      TEXT    NOT NULL,
  version_id  TEXT    NOT NULL,
  capacity    INTEGER NOT NULL,
  changelog   TEXT,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

CREATE TABLE IF NOT EXISTS entry (
  prefix      TEXT    NOT NULL,
  version_id  TEXT    NOT NULL,
  position    INTEGER NOT NULL,
  value       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id, position),
  FOREIGN KEY (prefix, version_id)
    REFERENCES schema_version(prefix, version_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_range
  ON entry (prefix, version_id, position);

CREATE INDEX IF NOT EXISTS idx_entry_value
  ON entry (prefix, version_id, value);

CREATE TABLE IF NOT EXISTS entry_flag (
  prefix      TEXT NOT NULL,
  version_id  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('active', 'inactive')),
  reason      TEXT,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (prefix, version_id, position)
    REFERENCES entry(prefix, version_id, position)
);

CREATE INDEX IF NOT EXISTS idx_entry_flag_lookup
  ON entry_flag (prefix, version_id, position, updated_at DESC);

CREATE TABLE IF NOT EXISTS address_state_cache (
  prefix         TEXT NOT NULL,
  version_id     TEXT NOT NULL,
  specs_json     TEXT NOT NULL,
  reserved_json  TEXT NOT NULL,
  inactive_json  TEXT NOT NULL,
  open_json      TEXT NOT NULL,
  computed_at    TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id)
);
`;

export class BetterSqliteDriver implements SqlDriver {
  private readonly db: Database.Database;

  constructor(path: string = ":memory:") {
    this.db = new Database(path);
    this.db.exec(SCHEMA_DDL);
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async queryOne<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T) ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}
