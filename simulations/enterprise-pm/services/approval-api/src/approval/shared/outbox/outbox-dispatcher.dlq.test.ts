// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * spec 04 §2.3 마지막 — DLQ 진입과 backoff 시퀀스 회귀 검증.
 *
 * 1. 연속 5 회 실패 → 6 번째 실패에서 status='dlq' + DLQ outbox 이벤트 발행.
 * 2. backoff 1s → 2s → 4s → 8s → 16s (각 ±200ms 허용) — `next_attempt_at` 컬럼이
 *    재시작·교체 후에도 backoff 상태를 보존한다.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIdempotencyKey } from 'sim-identifier-grammar';

import { createOutboxDispatcher } from './outbox-dispatcher.js';
import {
  SIM_APPROVAL_PG_RESET_DDL,
  SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL,
} from '../../pg/schema.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

describe.skipIf(!PG_AVAILABLE)('outbox dispatcher DLQ', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  const failing = async () => {
    throw new Error('downstream-down');
  };

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
    await sql.unsafe(SIM_APPROVAL_PG_RESET_DDL);
    await sql.unsafe(SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL);
    db = drizzle({ client: sql });

    const occurredAt = 1_714_250_400_000;
    const idempotencyKey = buildIdempotencyKey({
      aggregateId: 'br-fail',
      eventName: 'approval.budget.submitted',
      occurredAt,
    });
    await sql`
      INSERT INTO sim.approval_outbox_events
        (id, aggregate_id, event_name, event_version, payload,
         occurred_at, scope_id, status, idempotency_key, retry_count)
      VALUES (
        'evt-fail', 'br-fail', 'approval.budget.submitted', 1, '{}',
        ${occurredAt}, 'tx-test', 'pending', ${idempotencyKey}, 0)`;
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_outbox_events CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it('연속 5 회 실패 후 6 번째 실패에서 DLQ + DLQ 이벤트 발행', async () => {
    const disp = createOutboxDispatcher({
      db,
      sql,
      consumerName: 'sim-approval-api',
      consume: failing,
      batchSize: 10,
      maxRetries: 5,
    });

    for (let i = 0; i < 6; i++) {
      // 매 사이클마다 backoff 무력화 — 즉시 재시도.
      // status 는 dispatcher 가 'failed' 로 두기 때문에 별도 reset 불필요 (poller 가
      // status IN ('pending','failed') 둘 다 폴링).
      await sql`
        UPDATE sim.approval_outbox_events
        SET next_attempt_at = NULL
        WHERE id = 'evt-fail' AND status IN ('pending', 'failed')`;
      await disp.tick();
    }

    const final = await sql<{ status: string; retry_count: number }[]>`
      SELECT status, retry_count
      FROM sim.approval_outbox_events
      WHERE id = 'evt-fail'`;
    expect(final[0].status).toBe('dlq');
    expect(final[0].retry_count).toBeGreaterThan(5);

    const dlqEvts = await sql<{ id: string }[]>`
      SELECT id
      FROM sim.approval_outbox_events
      WHERE event_name = 'approval.outbox.dlq-entered'`;
    expect(dlqEvts.length).toBe(1);
    expect(dlqEvts[0].id).toBe('dlq-evt-fail');
  });

  it('backoff 시퀀스 1s → 2s → 4s → 8s → 16s (±200ms 허용)', async () => {
    const disp = createOutboxDispatcher({
      db,
      sql,
      consumerName: 'sim-approval-api',
      consume: failing,
      batchSize: 10,
      maxRetries: 5,
    });

    const expected = [1_000, 2_000, 4_000, 8_000, 16_000];
    for (let i = 0; i < expected.length; i++) {
      await sql`
        UPDATE sim.approval_outbox_events
        SET next_attempt_at = NULL
        WHERE id = 'evt-fail'`;
      await sql`DELETE FROM sim.outbox_consumer_log`;
      const before = Date.now();
      await disp.tick();
      const row = await sql<{ next_attempt_at: number | null }[]>`
        SELECT next_attempt_at
        FROM sim.approval_outbox_events
        WHERE id = 'evt-fail'`;
      const delta = (row[0].next_attempt_at ?? 0) - before;
      expect(delta).toBeGreaterThanOrEqual(expected[i] - 200);
      expect(delta).toBeLessThanOrEqual(expected[i] + 200);
    }
  });
});
