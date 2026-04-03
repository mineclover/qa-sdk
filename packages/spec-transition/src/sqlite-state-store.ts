/**
 * SqliteStateStore — SQLite 기반 영속 상태 저장소.
 *
 * index-meta의 SqlDriver를 재사용한다.
 * createSqliteDriver({ schema: null })로 bare driver를 받아 자체 스키마를 적용.
 */

/**
 * 비동기 StateStore 인터페이스.
 * InMemoryStateStore(동기)와 달리 SQLite는 async이므로 별도 인터페이스.
 */
export interface AsyncStateStore {
  get(contextId: string, resourceId: string, axis: string): Promise<string | null>;
  set(contextId: string, resourceId: string, axis: string, value: string): Promise<void>;
  unset(contextId: string, resourceId: string, axis: string): Promise<void>;
  snapshot(contextId: string, resourceId: string): Promise<Record<string, string>>;
  clear(): Promise<void>;
}

/** index-meta SqlDriver 최소 인터페이스 (의존 최소화) */
export interface SqlDriver {
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
}

const DDL = `
CREATE TABLE IF NOT EXISTS transition_state (
  context_id  TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  axis        TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (context_id, resource_id, axis)
);
CREATE INDEX IF NOT EXISTS idx_ts_context ON transition_state(context_id);
`;

export class SqliteStateStore implements AsyncStateStore {
  private readonly db: SqlDriver;
  private initialized = false;

  constructor(db: SqlDriver) {
    this.db = db;
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;
    for (const stmt of DDL.split(";").map(s => s.trim()).filter(Boolean)) {
      await this.db.execute(stmt);
    }
    this.initialized = true;
  }

  async get(contextId: string, resourceId: string, axis: string): Promise<string | null> {
    await this.ensureSchema();
    const row = await this.db.queryOne<{ value: string }>(
      "SELECT value FROM transition_state WHERE context_id = ? AND resource_id = ? AND axis = ?",
      [contextId, resourceId, axis],
    );
    return row?.value ?? null;
  }

  async set(contextId: string, resourceId: string, axis: string, value: string): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(
      `INSERT INTO transition_state (context_id, resource_id, axis, value, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (context_id, resource_id, axis)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [contextId, resourceId, axis, value],
    );
  }

  async unset(contextId: string, resourceId: string, axis: string): Promise<void> {
    await this.ensureSchema();
    await this.db.execute(
      "DELETE FROM transition_state WHERE context_id = ? AND resource_id = ? AND axis = ?",
      [contextId, resourceId, axis],
    );
  }

  async snapshot(contextId: string, resourceId: string): Promise<Record<string, string>> {
    await this.ensureSchema();
    const rows = await this.db.query<{ axis: string; value: string }>(
      "SELECT axis, value FROM transition_state WHERE context_id = ? AND resource_id = ?",
      [contextId, resourceId],
    );
    const result: Record<string, string> = {};
    for (const row of rows) result[row.axis] = row.value;
    return result;
  }

  async clear(): Promise<void> {
    await this.ensureSchema();
    await this.db.execute("DELETE FROM transition_state");
  }
}
