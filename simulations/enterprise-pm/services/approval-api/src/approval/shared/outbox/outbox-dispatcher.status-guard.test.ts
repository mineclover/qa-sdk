// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * spec 04 §2.3 — `WHERE id=$1 AND status='pending'` 가드의 동시성 회귀 검증.
 *
 * 두 별도 connection 이 같은 row 를 동시에 UPDATE 하면, 가드가 있는 경우 한 쪽만
 * ROW_COUNT=1 이 되고 나머지는 0 (자기 시도가 자연스럽게 no-op). 가드가 없으면
 * 두 UPDATE 모두 ROW_COUNT=1 이 되어 같은 이벤트가 두 번 처리될 위험.
 */
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIdempotencyKey } from "sim-identifier-grammar";

import {
  SIM_APPROVAL_PG_RESET_DDL,
  SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL,
} from "../../pg/schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("outbox status 전이 동시성 가드", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  const cfg = () => ({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 5,
    onnotice: () => {},
  });

  let setup: ReturnType<typeof postgres>;
  let sqlA: ReturnType<typeof postgres>;
  let sqlB: ReturnType<typeof postgres>;

  beforeEach(async () => {
    setup = postgres(cfg());
    await setup.unsafe(SIM_APPROVAL_PG_RESET_DDL);
    await setup.unsafe(SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL);

    const occurredAt = 1_714_250_400_000;
    const idempotencyKey = buildIdempotencyKey({
      aggregateId: "br-001",
      eventName: "approval.budget.submitted",
      occurredAt,
    });
    await setup`
      INSERT INTO sim.approval_outbox_events
        (id, aggregate_id, event_name, event_version, payload,
         occurred_at, scope_id, status, idempotency_key, retry_count)
      VALUES (
        'evt-1', 'br-001', 'approval.budget.submitted', 1, '{}',
        ${occurredAt}, 'tx-test', 'pending', ${idempotencyKey}, 0)`;

    sqlA = postgres(cfg());
    sqlB = postgres(cfg());
  });

  afterEach(async () => {
    try {
      await setup.unsafe(`DROP TABLE IF EXISTS sim.approval_outbox_events CASCADE`);
      await setup.unsafe(`DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE`);
    } finally {
      await Promise.all([setup.end(), sqlA.end(), sqlB.end()]);
    }
  });

  it("동시 두 트랜잭션 UPDATE 시도 → 정확히 1 ROW_COUNT 만 1, 나머지 0", async () => {
    const [r1, r2] = await Promise.all([
      sqlA.begin(async (tx) => {
        const r = await tx`
          UPDATE sim.approval_outbox_events
          SET status = 'dispatched', dispatched_at = ${Date.now()}
          WHERE id = 'evt-1' AND status = 'pending'`;
        return r.count;
      }),
      sqlB.begin(async (tx) => {
        const r = await tx`
          UPDATE sim.approval_outbox_events
          SET status = 'dispatched', dispatched_at = ${Date.now()}
          WHERE id = 'evt-1' AND status = 'pending'`;
        return r.count;
      }),
    ]);
    expect([r1, r2].sort()).toEqual([0, 1]);

    const final = await setup<{ status: string }[]>`
      SELECT status FROM sim.approval_outbox_events WHERE id = 'evt-1'`;
    expect(final[0].status).toBe("dispatched");
  });

  it("status='pending' 가드 누락 시 두 트랜잭션 모두 ROW_COUNT=1 (가드 필요성 음성 통제)", async () => {
    const [r1, r2] = await Promise.all([
      sqlA.begin(async (tx) => {
        const r = await tx`
          UPDATE sim.approval_outbox_events
          SET status = 'dispatched', dispatched_at = ${Date.now()}
          WHERE id = 'evt-1'`;
        return r.count;
      }),
      sqlB.begin(async (tx) => {
        const r = await tx`
          UPDATE sim.approval_outbox_events
          SET status = 'dispatched', dispatched_at = ${Date.now()}
          WHERE id = 'evt-1'`;
        return r.count;
      }),
    ]);
    // 가드 없으면 두 UPDATE 가 sequential 으로 둘 다 row 1 hit.
    expect(r1 + r2).toBe(2);
  });
});
