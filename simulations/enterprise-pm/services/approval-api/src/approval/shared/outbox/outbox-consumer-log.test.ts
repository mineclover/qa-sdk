// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL } from './outbox-consumer-log.schema.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

describe.skipIf(!PG_AVAILABLE)('sim.outbox_consumer_log DDL', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;

  beforeEach(async () => {
    sql = postgres({
      host: PG_HOST,
      port: PG_PORT,
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      max: 5,
      onnotice: () => {},
    });
    await sql.unsafe(SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL);
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('up: 컬럼 3종 + UNIQUE 제약 생성', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'sim' AND table_name = 'outbox_consumer_log'
      ORDER BY column_name`;
    expect(cols.map((r) => r.column_name)).toEqual(['consumer', 'idempotency_key', 'processed_at']);

    const uniques = await sql<{ constraint_name: string }[]>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'sim'
        AND table_name = 'outbox_consumer_log'
        AND constraint_type = 'UNIQUE'`;
    expect(uniques.map((r) => r.constraint_name)).toContain('uq_sim_outbox_consumer_log_key');
  });

  it('ON CONFLICT (idempotency_key, consumer) DO NOTHING — 두 번째 INSERT는 RETURNING 비어 있음', async () => {
    const first = await sql<{ idempotency_key: string }[]>`
      INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
      VALUES ('proj-001:approval.budget.submitted:1714250400000', 'sim-approval-api', 1)
      ON CONFLICT (idempotency_key, consumer) DO NOTHING
      RETURNING idempotency_key`;
    expect(first.length).toBe(1);

    const second = await sql<{ idempotency_key: string }[]>`
      INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
      VALUES ('proj-001:approval.budget.submitted:1714250400000', 'sim-approval-api', 2)
      ON CONFLICT (idempotency_key, consumer) DO NOTHING
      RETURNING idempotency_key`;
    expect(second.length).toBe(0);
  });

  it('같은 key + 다른 consumer 는 둘 다 통과 (cross-consumer 격리)', async () => {
    const a = await sql<{ idempotency_key: string }[]>`
      INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
      VALUES ('proj-001:approval.budget.submitted:1714250400000', 'sim-approval-api', 1)
      ON CONFLICT (idempotency_key, consumer) DO NOTHING
      RETURNING idempotency_key`;
    const b = await sql<{ idempotency_key: string }[]>`
      INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
      VALUES ('proj-001:approval.budget.submitted:1714250400000', 'sim-pm-api', 1)
      ON CONFLICT (idempotency_key, consumer) DO NOTHING
      RETURNING idempotency_key`;
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
  });
});
