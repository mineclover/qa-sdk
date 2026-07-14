// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * D1SqlDriver — Cloudflare D1 바인딩을 SqlDriver 인터페이스로 래핑
 *
 * 이 어댑터를 사용하면 SqlPrefixRegistry, SqlEntryFlagStore,
 * SqlAddressStateStore, SqlAddressRangeCache 등 모든 Sql* 스토어를
 * D1에서 그대로 사용할 수 있다.
 *
 * @example
 * const driver = new D1SqlDriver(env.DB);
 * const registry = new SqlPrefixRegistry(driver);
 * const flagStore = new SqlEntryFlagStore(driver);
 */

import type { SqlDriver, SqlDialect, ExecuteResult } from './sql-store.js';
import type { D1Database } from './d1-store.js';

const D1_DIALECT: SqlDialect = {
  name: 'd1',
  supportsTransaction: false,
  supportsReturning: true,
  supportsJsonType: false,
  supportsUpsert: true,
};

export class D1SqlDriver implements SqlDriver {
  readonly dialect = D1_DIALECT;

  constructor(private readonly db: D1Database) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<T>();
    return result.results;
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (
      (await this.db
        .prepare(sql)
        .bind(...params)
        .first<T>()) ?? null
    );
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    await this.db
      .prepare(sql)
      .bind(...params)
      .run();
    // D1 run() does not reliably expose changes count
    return { rowsAffected: 0 };
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    // D1 Workers API does not support multi-statement transactions.
    // Execute operations sequentially without transactional wrapping.
    return fn(this);
  }

  async batchExecute(sql: string, paramsList: unknown[][]): Promise<void> {
    for (const params of paramsList) {
      await this.execute(sql, params);
    }
  }
}
