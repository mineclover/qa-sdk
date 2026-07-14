import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RLS_SHADOW_DECISIONS_PG_DDL } from './shadow-schema.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

/**
 * audit.rls_shadow_decisions 스키마 검증.
 * 다른 audit RLS 테스트가 audit.audit_entries 만 사용하므로 본 테이블은 fileParallelism 영향 없음.
 */
describe.skipIf(!PG_AVAILABLE)('audit.rls_shadow_decisions schema', () => {
  const adminCfg = {
    host: process.env.QA_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
    database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    user: 'qa_admin',
    password: process.env.QA_TEST_PG_PASSWORD ?? '',
  };
  let sql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    sql = postgres({ ...adminCfg, max: 2, onnotice: () => {} });
    await sql.unsafe(`DROP TABLE IF EXISTS audit.rls_shadow_decisions CASCADE`);
    await sql.unsafe(RLS_SHADOW_DECISIONS_PG_DDL);
  });
  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS audit.rls_shadow_decisions CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('INSERT + SELECT — admin bypass 로 통과', async () => {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.role', 'admin', true)`;
      await tx`INSERT INTO audit.rls_shadow_decisions
        (id, occurred_at, user_id, resource_table, operation, application_decision, rls_would_decision, divergence, deny_reason)
        VALUES ('s1', now(), 'alice', 'auth.resource_policies', 'select', 'allow', 'deny', true, 'bitmap_bit_missing')`;
      const rows = await tx`SELECT id FROM audit.rls_shadow_decisions`;
      expect(rows.length).toBe(1);
    });
  });

  it('CHECK constraint — invalid operation 차단', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SELECT set_config('app.role', 'admin', true)`;
        await tx`INSERT INTO audit.rls_shadow_decisions (id, occurred_at, resource_table, operation, application_decision, rls_would_decision, divergence) VALUES ('x', now(), 't', 'truncate', 'allow', 'allow', false)`;
      }),
    ).rejects.toThrow(/check constraint/i);
  });
});
