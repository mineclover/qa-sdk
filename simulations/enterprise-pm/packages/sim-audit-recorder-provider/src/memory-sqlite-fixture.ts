// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * In-memory SQLite fixture — 단위 테스트 + 시나리오 runner 가 AuditRecorder 를
 * 격리된 DB 에서 바로 소비할 수 있도록 helper 제공.
 *
 * 실 audit-recorder-store 의 SQLite DDL (AUDIT_ENTRIES_DDL) 을 그대로 불러와
 * `:memory:` 에 적용. peerDep `better-sqlite3` 요구.
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// audit-recorder-store 의 SQLite DDL 을 SSOT 로 사용 — 본 fixture 는 re-export만.
export { AUDIT_ENTRIES_DDL } from 'audit-recorder-store';
import { AUDIT_ENTRIES_DDL as DDL } from 'audit-recorder-store';

export interface InMemorySqliteFixture {
  /** raw better-sqlite3 instance — PRAGMA 등 low-level 조작용. */
  sqlite: DatabaseType;
  /** drizzle wrapper — audit-recorder-store adapter 에 주입. */
  db: BetterSQLite3Database<Record<string, never>>;
  /** 리소스 해제 — 테스트 afterEach 에서 호출. */
  close: () => void;
}

/**
 * createInMemorySqliteFixture — `:memory:` SQLite + audit-recorder DDL 자동 적용.
 */
export function createInMemorySqliteFixture(): InMemorySqliteFixture {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  const db = drizzle({ client: sqlite });
  return {
    sqlite,
    db,
    close: () => sqlite.close(),
  };
}
