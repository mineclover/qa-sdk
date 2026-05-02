// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * BetterSqliteDriver — better-sqlite3 기반 SqlDriver 구현
 *
 * 프로덕션 Node.js 서버에서 사용한다.
 * native 바인딩이 필요하므로 빌드 환경에 C++ 컴파일러가 있어야 한다.
 */

import Database from "better-sqlite3";
import type { SqlDriver, ExecuteResult } from "./sql-store.js";
import { SQLITE_DIALECT, runTransaction } from "./sqlite-shared.js";

export class BetterSqliteDriver implements SqlDriver {
  private readonly db: Database.Database;

  readonly dialect = SQLITE_DIALECT;

  /**
   * @param path SQLite 파일 경로 (기본 `:memory:`)
   * @param schema 초기 DDL. `null` 전달 시 DDL 없이 bare driver 생성.
   */
  constructor(path: string = ":memory:", schema?: string | null) {
    this.db = new Database(path);
    if (schema) this.db.exec(schema);
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async queryOne<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T) ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const info = this.db.prepare(sql).run(...params);
    return { rowsAffected: info.changes };
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    return runTransaction(s => this.db.exec(s), this, fn);
  }

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    const statement = this.db.prepare(sql);
    this.db.exec("BEGIN");
    try {
      for (const params of paramsList) {
        statement.run(...params);
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
