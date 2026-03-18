/**
 * NodeSqliteDriver — Node 내장 node:sqlite 기반 SqlDriver 구현
 *
 * 공개 API 이름은 유지하되, 로컬 빌드/테스트 안정성을 위해
 * Node 내장 `node:sqlite`를 사용한다.
 */

import { createRequire } from "node:module";
import type { SqlDriver, SqlDialect, ExecuteResult } from "./sql-store.js";

type DatabaseSyncCtor = typeof import("node:sqlite").DatabaseSync;
type DatabaseSyncInstance = InstanceType<DatabaseSyncCtor>;

let _DatabaseSync: DatabaseSyncCtor | null = null;

function getDatabaseSync(): DatabaseSyncCtor {
  if (!_DatabaseSync) {
    const require = createRequire(import.meta.url);
    _DatabaseSync = (require("node:sqlite") as { DatabaseSync: DatabaseSyncCtor }).DatabaseSync;
  }
  return _DatabaseSync;
}

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

CREATE TABLE IF NOT EXISTS prefix_route (
  prefix          TEXT NOT NULL PRIMARY KEY,
  d1_database_id  TEXT NOT NULL,
  routed_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prefix_route_database
  ON prefix_route (d1_database_id, routed_at, prefix);

CREATE TABLE IF NOT EXISTS schema_version (
  prefix      TEXT    NOT NULL,
  version_id  TEXT    NOT NULL,
  capacity    INTEGER NOT NULL,
  changelog   TEXT,
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

CREATE TABLE IF NOT EXISTS version_lifecycle (
  prefix             TEXT NOT NULL,
  version_id         TEXT NOT NULL,
  status             TEXT NOT NULL
    CHECK(status IN ('draft', 'released', 'active', 'deprecated')),
  base_version_id    TEXT,
  capacity           INTEGER NOT NULL,
  deactivation_mode  TEXT NOT NULL
    CHECK(deactivation_mode IN ('strict', 'flexible')),
  created_at         TEXT NOT NULL,
  released_at        TEXT,
  PRIMARY KEY (prefix, version_id)
);

CREATE INDEX IF NOT EXISTS idx_version_lifecycle_prefix_created
  ON version_lifecycle (prefix, created_at);

CREATE INDEX IF NOT EXISTS idx_version_lifecycle_prefix_status
  ON version_lifecycle (prefix, status, created_at);

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

CREATE TABLE IF NOT EXISTS migration_mapping (
  prefix           TEXT NOT NULL,
  from_version_id  TEXT NOT NULL,
  to_version_id    TEXT NOT NULL,
  position         INTEGER NOT NULL,
  change_type      TEXT NOT NULL
    CHECK(change_type IN ('modified', 'deactivated')),
  old_entity_id    TEXT,
  new_entity_id    TEXT,
  created_at       TEXT NOT NULL,
  PRIMARY KEY (prefix, from_version_id, to_version_id, position)
);

CREATE INDEX IF NOT EXISTS idx_migration_mapping_history
  ON migration_mapping (prefix, position, created_at, from_version_id, to_version_id);

CREATE INDEX IF NOT EXISTS idx_migration_mapping_edge
  ON migration_mapping (prefix, from_version_id, to_version_id, position);

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

CREATE TABLE IF NOT EXISTS address_range_cache (
  prefix           TEXT NOT NULL,
  version_id       TEXT NOT NULL,
  label            TEXT NOT NULL,
  ranges_json      TEXT NOT NULL,
  constraints_json TEXT,
  computed_at      TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id, label)
);

CREATE INDEX IF NOT EXISTS idx_range_cache_version
  ON address_range_cache (prefix, version_id);
`;

export class NodeSqliteDriver implements SqlDriver {
  private readonly db: DatabaseSyncInstance;

  readonly dialect: SqlDialect = {
    name: "sqlite",
    supportsTransaction: true,
    supportsReturning: true,
    supportsJsonType: false,
    supportsUpsert: true,
  };

  /**
   * @param path SQLite 파일 경로 (기본 `:memory:`)
   * @param schema 초기 DDL. 생략 시 index-meta 전체 스키마 적용,
   *               `null` 전달 시 DDL 없이 bare driver 생성.
   */
  constructor(path: string = ":memory:", schema?: string | null) {
    const DatabaseSync = getDatabaseSync();
    this.db = new DatabaseSync(path);
    const ddl = schema === undefined ? SCHEMA_DDL : schema;
    if (ddl) this.db.exec(ddl);
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...toSqlParams(params)) as T[];
  }

  async queryOne<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    return (this.db.prepare(sql).get(...toSqlParams(params)) as T) ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const info = this.db.prepare(sql).run(...toSqlParams(params));
    return { rowsAffected: Number(info.changes) };
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

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    const statement = this.db.prepare(sql);
    this.db.exec("BEGIN");
    try {
      for (const params of paramsList) {
        statement.run(...toSqlParams(params));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

function toSqlParams(params: unknown[]): any[] {
  return params as any[];
}
