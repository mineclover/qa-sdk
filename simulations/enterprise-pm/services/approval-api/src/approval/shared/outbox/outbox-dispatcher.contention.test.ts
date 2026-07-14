// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * spec 04 §2.4 — 다중 dispatcher 동시 폴링 시 disjoint 보장 단위 검증.
 *
 * N=3 dispatcher 가 동시에 폴링할 때
 *   (a) 처리한 row 집합이 서로 disjoint (중복 0)
 *   (b) 총 처리 수가 INSERT row 수와 정확히 일치 (누락 0)
 *
 * 시나리오 #15 (`outbox-multi-dispatcher-lock`) 부하·복합 검증은 Plan E
 * `05-error-and-scenarios.md` §3 으로 분리한다 — 본 테스트는 핵심 메커니즘만 책임진다.
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

describe.skipIf(!PG_AVAILABLE)('N dispatcher contention (SKIP LOCKED disjoint)', () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? 'localhost';
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? '5434');
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test';
  const PG_USER = process.env.QA_TEST_PG_USER ?? 'qa_admin';
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? '';

  const cfg = () => ({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 5,
    onnotice: () => {},
  });

  const N = 3;
  const ROWS = 30;

  let setup: ReturnType<typeof postgres>;
  let pools: ReturnType<typeof postgres>[] = [];

  beforeEach(async () => {
    setup = postgres(cfg());
    await setup.unsafe(SIM_APPROVAL_PG_RESET_DDL);
    await setup.unsafe(SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL);

    const baseTime = 1_714_250_400_000;
    for (let i = 0; i < ROWS; i++) {
      const aggregateId = `br-${String(i).padStart(3, '0')}`;
      const idempotencyKey = buildIdempotencyKey({
        aggregateId,
        eventName: 'approval.budget.submitted',
        occurredAt: baseTime + i,
      });
      await setup`
        INSERT INTO sim.approval_outbox_events
          (id, aggregate_id, event_name, event_version, payload,
           occurred_at, scope_id, status, idempotency_key, retry_count)
        VALUES (
          ${`evt-${i}`}, ${aggregateId}, 'approval.budget.submitted', 1, '{}',
          ${baseTime + i}, 'tx-test', 'pending', ${idempotencyKey}, 0)`;
    }

    pools = Array.from({ length: N }, () => postgres(cfg()));
  });

  afterEach(async () => {
    try {
      await setup.unsafe(`DROP TABLE IF EXISTS sim.approval_outbox_events CASCADE`);
      await setup.unsafe(`DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE`);
    } finally {
      await Promise.all([setup.end(), ...pools.map((p) => p.end())]);
    }
  });

  it('N=3 dispatcher 동시 polling — disjoint + 총합 = INSERT row 수', async () => {
    const claimed: string[][] = pools.map(() => []);
    const dispatchers = pools.map((sql, idx) =>
      createOutboxDispatcher({
        db: drizzle({ client: sql }),
        sql,
        consumerName: `sim-approval-api-${idx}`,
        consume: async (e) => {
          claimed[idx].push(e.id);
        },
        batchSize: 10,
        maxRetries: 5,
      }),
    );

    // 각 dispatcher 가 10 회씩 tick (총 30 병렬 tick) — 30 row 를 분담 처리.
    const ticks = await Promise.all(
      dispatchers.flatMap((d) => Array.from({ length: 10 }, () => d.tick())),
    );
    const totalProcessed = ticks.reduce((a, b) => a + b, 0);
    expect(totalProcessed).toBe(ROWS);

    const allClaimed = claimed.flat().sort();
    expect(new Set(allClaimed).size).toBe(ROWS); // disjoint
    expect(allClaimed.length).toBe(ROWS); // 총합 일치

    const remaining = await setup<{ status: string }[]>`
      SELECT status FROM sim.approval_outbox_events`;
    expect(remaining.every((r) => r.status === 'dispatched')).toBe(true);

    const log = await setup<{ idempotency_key: string }[]>`
      SELECT idempotency_key FROM sim.outbox_consumer_log`;
    expect(log.length).toBe(ROWS);
  });
});
