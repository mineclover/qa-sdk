/**
 * BetterSqliteDriver — better-sqlite3 기반 SqlDriver 구현
 *
 * 로컬 테스트 및 개발 환경에서 사용한다.
 * better-sqlite3는 동기 API이므로 Promise.resolve()로 래핑한다.
 */

import Database from "better-sqlite3";
import type { SqlDriver } from "./sql-store.js";

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS schema_version (
  table_id   TEXT    NOT NULL,
  version_id TEXT    NOT NULL,
  capacity   INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (table_id, version_id)
);

CREATE TABLE IF NOT EXISTS entry (
  table_id   TEXT    NOT NULL,
  version_id TEXT    NOT NULL,
  position   INTEGER NOT NULL,
  value      TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (table_id, version_id, position)
);

CREATE INDEX IF NOT EXISTS idx_entry_range
  ON entry (table_id, version_id, position);

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

  close(): void {
    this.db.close();
  }
}
