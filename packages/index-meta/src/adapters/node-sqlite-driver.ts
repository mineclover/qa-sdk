// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * NodeSqliteDriver — Node 내장 node:sqlite 기반 SqlDriver 구현
 *
 * 공개 API 이름은 유지하되, 로컬 빌드/테스트 안정성을 위해
 * Node 내장 `node:sqlite`를 사용한다.
 */

import type { SqlDriver, ExecuteResult } from "./sql-store.js";
import { getDatabaseSync, type DatabaseSyncInstance } from "./database-sync-loader.js";
import { SQLITE_DIALECT, runTransaction } from "./sqlite-shared.js";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 패키지 루트의 drizzle/ 또는 번들 산출물의 dist/drizzle 경로를 찾는다.
 * vitest(src/adapters)와 tsup 번들(dist, dist/chunks) 모두를 지원한다.
 */
function findMigrationsFolder(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    for (const candidate of [join(dir, "drizzle"), join(dir, "dist", "drizzle")]) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    dir = dirname(dir);
  }
  return null;
}

const indexMetaMigrationsFolder = findMigrationsFolder();

function requireMigrationsFolder(): string {
  if (indexMetaMigrationsFolder) {
    return indexMetaMigrationsFolder;
  }

  throw new Error(
    "[index-meta] drizzle migrations folder not found. Expected package drizzle/ or dist/drizzle next to the bundle."
  );
}

export class NodeSqliteDriver implements SqlDriver {
  /** @internal drizzle migrate 등 low-level 접근용 */
  readonly $client: DatabaseSyncInstance;
  private readonly db: DatabaseSyncInstance;

  readonly dialect = SQLITE_DIALECT;

  /**
   * @param path SQLite 파일 경로 (기본 `:memory:`)
   * @param schema 초기 DDL. 생략 시 drizzle migration으로 index-meta 전체 스키마 적용,
   *               `null` 전달 시 DDL 없이 bare driver 생성.
   */
  constructor(path: string = ":memory:", schema?: string | null) {
    const DatabaseSync = getDatabaseSync();
    this.db = new DatabaseSync(path);
    this.$client = this.db;
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 3000");
    this.db.exec("PRAGMA foreign_keys = ON");

    if (schema === undefined) {
      const drizzleDb = drizzle({ client: this.db });
      migrate(drizzleDb, { migrationsFolder: requireMigrationsFolder() });
    } else if (schema) {
      this.db.exec(schema);
    }
    // schema === null → bare driver (DDL 없음)
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
    return runTransaction(s => this.db.exec(s), this, fn);
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

type SqliteBindValue = string | number | bigint | Uint8Array | null;

function toSqlParams(params: unknown[]): SqliteBindValue[] {
  return params as SqliteBindValue[];
}
