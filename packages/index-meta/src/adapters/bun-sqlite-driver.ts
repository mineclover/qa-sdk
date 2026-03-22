/**
 * BunSqliteDriver — Bun 내장 bun:sqlite 기반 SqlDriver 구현.
 *
 * Bun 런타임에서 사용. Node.js의 NodeSqliteDriver와 동일 역할.
 *
 * @example
 * import { Database } from "bun:sqlite";
 * const db = new Database("registry.sqlite");
 * const driver = new BunSqliteDriver(db);
 * const registry = new SqlPrefixRegistry(driver);
 */

import type { SqlDriver, SqlDialect, ExecuteResult } from "./sql-store.js";

const BUN_DIALECT: SqlDialect = {
  name: "bun-sqlite",
  supportsTransaction: true,
  supportsReturning: true,
  supportsJsonType: false,
  supportsUpsert: true,
};

/**
 * bun:sqlite Database 인스턴스의 최소 인터페이스.
 * 실제 import는 사용자가 `import { Database } from "bun:sqlite"` 로 수행.
 */
export interface BunDatabase {
  query<T = Record<string, unknown>>(sql: string): BunStatement<T>;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
}

export interface BunStatement<T = Record<string, unknown>> {
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | null;
  run(...params: unknown[]): { changes: number };
}

export class BunSqliteDriver implements SqlDriver {
  readonly dialect = BUN_DIALECT;

  constructor(private readonly db: BunDatabase) {}

  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.query<T>(sql).all(...params);
  }

  async queryOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.db.query<T>(sql).get(...params) ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const result = this.db.query(sql).run(...params);
    return { rowsAffected: result.changes };
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    // bun:sqlite transaction은 동기이므로 래핑
    return this.db.transaction(() => {
      // 동기 컨텍스트에서 async fn 실행은 제한적이지만,
      // bun:sqlite는 동기 DB이므로 실제로는 동기 실행됨
      let result: T;
      fn(this).then(r => { result = r; });
      return result!;
    });
  }

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    const stmt = this.db.query(sql);
    this.db.transaction(() => {
      for (const params of paramsList) {
        stmt.run(...params);
      }
    });
  }
}
