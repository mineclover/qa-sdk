// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlPrefixRouter — PrefixRouter의 SQL 구현
 *
 * prefix_route 테이블을 SqlDriver로 읽고 쓴다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 */

import type { PrefixRouter } from "../prefix-router.js";
import type { SqlDriver } from "./sql-store.js";

interface PrefixRouteRow extends Record<string, unknown> {
  prefix: string;
  d1_database_id: string;
  routed_at: string;
}

export class SqlPrefixRouter implements PrefixRouter {
  constructor(private readonly driver: SqlDriver) {}

  async getDatabase(prefix: string): Promise<string | null> {
    const row = await this.driver.queryOne<{ d1_database_id: string }>(
      `SELECT d1_database_id
       FROM prefix_route
       WHERE prefix = ?`,
      [prefix],
    );

    return row?.d1_database_id ?? null;
  }

  async route(prefix: string, d1DatabaseId: string): Promise<void> {
    const existing = await this.driver.queryOne<{ prefix: string }>(
      `SELECT prefix
       FROM prefix_route
       WHERE prefix = ?`,
      [prefix],
    );

    if (existing) {
      await this.driver.execute(
        `UPDATE prefix_route
         SET d1_database_id = ?
         WHERE prefix = ?`,
        [d1DatabaseId, prefix],
      );
      return;
    }

    await this.driver.execute(
      `INSERT INTO prefix_route (prefix, d1_database_id, routed_at)
       VALUES (?, ?, ?)`,
      [prefix, d1DatabaseId, new Date().toISOString()],
    );
  }

  async listPrefixes(d1DatabaseId: string): Promise<string[]> {
    const rows = await this.driver.query<PrefixRouteRow>(
      `SELECT prefix, d1_database_id, routed_at
       FROM prefix_route
       WHERE d1_database_id = ?
       ORDER BY routed_at ASC, prefix ASC`,
      [d1DatabaseId],
    );

    return rows.map((row) => row.prefix);
  }
}
