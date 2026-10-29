// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getClient } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { closeTestDb, createTestDb, hasTestDatabaseUrl } from './test-db.js';

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

/** schema.ts가 선언한 public 테이블의 `table.column` 목록 */
function declaredColumns(): string[] {
  return Object.values(schema)
    .flatMap((value) => (is(value, PgTable) ? [getTableConfig(value)] : []))
    .filter((config) => (config.schema ?? 'public') === 'public')
    .flatMap((config) => config.columns.map((column) => `${config.name}.${column.name}`))
    .sort();
}

describeIfDatabase('PG 스키마 parity (마이그레이션 ↔ schema.ts, X-18)', () => {
  beforeAll(async () => {
    await createTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('마이그레이션을 적용한 DB의 컬럼이 schema.ts 선언과 같다', async () => {
    const client = getClient(process.env.DATABASE_URL!);
    const rows = await client<{ column: string }[]>`
      select table_name || '.' || column_name as column
      from information_schema.columns
      where table_schema = 'public'
    `;
    const actual = rows.map((row) => row.column).sort();
    expect(actual).toEqual(declaredColumns());
  });
});
