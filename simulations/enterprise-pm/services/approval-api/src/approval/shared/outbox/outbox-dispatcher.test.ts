// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIdempotencyKey } from "sim-identifier-grammar";

import { createOutboxDispatcher } from "./outbox-dispatcher.js";
import {
  SIM_APPROVAL_PG_RESET_DDL,
  SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL,
} from "../../pg/schema.js";

const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

interface SeedRow {
  readonly id: string;
  readonly aggregateId: string;
  readonly eventName: string;
  readonly occurredAt: number;
}

function seedRows(): readonly SeedRow[] {
  const occ = 1_714_250_400_000;
  return [
    { id: "evt-1", aggregateId: "br-001", eventName: "approval.budget.submitted", occurredAt: occ + 1 },
    { id: "evt-2", aggregateId: "br-002", eventName: "approval.budget.submitted", occurredAt: occ + 2 },
    { id: "evt-3", aggregateId: "br-003", eventName: "approval.budget.submitted", occurredAt: occ + 3 },
    { id: "evt-4", aggregateId: "br-004", eventName: "approval.budget.submitted", occurredAt: occ + 4 },
    { id: "evt-5", aggregateId: "br-005", eventName: "approval.budget.submitted", occurredAt: occ + 5 },
  ];
}

describe.skipIf(!PG_AVAILABLE)("createOutboxDispatcher", () => {
  const PG_HOST = process.env.QA_TEST_PG_HOST ?? "localhost";
  const PG_PORT = Number(process.env.QA_TEST_PG_PORT ?? "5434");
  const PG_DATABASE = process.env.QA_TEST_PG_DATABASE ?? "qa_sdk_test";
  const PG_USER = process.env.QA_TEST_PG_USER ?? "qa_admin";
  const PG_PASSWORD = process.env.QA_TEST_PG_PASSWORD ?? "";

  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

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

    for (const r of seedRows()) {
      const idempotencyKey = buildIdempotencyKey({
        aggregateId: r.aggregateId,
        eventName: r.eventName,
        occurredAt: r.occurredAt,
      });
      await sql`
        INSERT INTO sim.approval_outbox_events
          (id, aggregate_id, event_name, event_version, payload,
           occurred_at, scope_id, status, idempotency_key, retry_count)
        VALUES (
          ${r.id}, ${r.aggregateId}, ${r.eventName}, 1, '{}',
          ${r.occurredAt}, 'tx-test', 'pending', ${idempotencyKey}, 0)`;
    }
  });

  afterEach(async () => {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS sim.approval_outbox_events CASCADE`);
      await sql.unsafe(`DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE`);
    } finally {
      await sql.end();
    }
  });

  it("seed 5 → 한 dispatcher 가 5 개 모두 dispatched + consumer-log 5 행", async () => {
    const calls: string[] = [];
    const disp = createOutboxDispatcher({
      db,
      sql,
      consumerName: "sim-approval-api",
      consume: async (e) => {
        calls.push(e.idempotencyKey);
      },
      batchSize: 10,
      maxRetries: 5,
    });

    expect(await disp.tick()).toBe(5);
    expect(calls.length).toBe(5);

    const log = await sql<{ idempotency_key: string }[]>`
      SELECT idempotency_key FROM sim.outbox_consumer_log`;
    expect(log.length).toBe(5);

    const statuses = await sql<{ status: string }[]>`
      SELECT status FROM sim.approval_outbox_events`;
    expect(statuses.every((r) => r.status === "dispatched")).toBe(true);
  });

  it("두 번째 tick 은 0 row (status='pending' 가드)", async () => {
    const disp = createOutboxDispatcher({
      db,
      sql,
      consumerName: "sim-approval-api",
      consume: async () => {},
      batchSize: 10,
      maxRetries: 5,
    });
    expect(await disp.tick()).toBe(5);
    expect(await disp.tick()).toBe(0);
  });

  it("consumer throw → status='failed' + retry_count=1 + next_attempt_at 설정", async () => {
    const disp = createOutboxDispatcher({
      db,
      sql,
      consumerName: "sim-approval-api",
      consume: async () => {
        throw new Error("downstream-down");
      },
      batchSize: 1,
      maxRetries: 5,
    });

    const before = Date.now();
    expect(await disp.tick()).toBe(0);

    const row = await sql<{
      status: string;
      retry_count: number;
      next_attempt_at: number | null;
    }[]>`
      SELECT status, retry_count, next_attempt_at
      FROM sim.approval_outbox_events
      WHERE id = 'evt-1'`;
    expect(row[0].status).toBe("failed");
    expect(row[0].retry_count).toBe(1);
    // backoff(1) = 1_000ms, ±200ms tolerance
    const delta = (row[0].next_attempt_at ?? 0) - before;
    expect(delta).toBeGreaterThanOrEqual(800);
    expect(delta).toBeLessThanOrEqual(1_200);
  });
});
