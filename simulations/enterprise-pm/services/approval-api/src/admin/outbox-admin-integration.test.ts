// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.6 — 진짜 PG 환경에서 outbox admin endpoint 두 개를 실제 호출.
// SIM_TEST_PG=1 env gate. PG URL: SIM_APPROVAL_PG_URL.
// invariant: insert N=5 → dispatch replicaCount=3 → byReplica disjoint + duplicates=0.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import postgres from "postgres";
import {
  SIM_APPROVAL_PG_RESET_DDL,
} from "../approval/pg/schema.js";
import { OutboxAdminModule } from "./outbox-admin.module.js";

const PG = process.env.SIM_TEST_PG === "1";
const internal = { "x-forwarded-for": "127.0.0.1" };

describe.skipIf(!PG)("OutboxAdmin integration (PG)", () => {
  let app: NestFastifyApplication;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const url = process.env.SIM_APPROVAL_PG_URL;
    if (!url) throw new Error("SIM_APPROVAL_PG_URL must be set when SIM_TEST_PG=1");
    sql = postgres(url, { onnotice: () => {} });

    const moduleRef = await Test.createTestingModule({
      imports: [OutboxAdminModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    await sql?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    // sim 스키마 + outbox_consumer_log 일괄 reset (RESET_DDL 이 둘을 함께 정의).
    await sql.unsafe(SIM_APPROVAL_PG_RESET_DDL);
  });

  it("insert N=5 → dispatch replicaCount=3 → byReplica disjoint + duplicates=0", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      aggregateId: `proj-${String(i + 1).padStart(3, "0")}`,
      eventName: "approval.budget.submitted",
      payload: { idx: i },
      occurredAt: 1714250400000 + i,
    }));

    const ins = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: internal,
      payload: { events },
    });
    expect(ins.statusCode).toBe(200);
    expect(ins.json().inserted).toBe(5);

    const dis = await app.inject({
      method: "POST",
      url: "/admin/outbox/dispatch",
      headers: internal,
      payload: { replicaCount: 3, timeoutMs: 5_000 },
    });
    expect(dis.statusCode).toBe(200);
    const body = dis.json();
    expect(body.totalDispatched).toBe(5);
    expect(body.duplicates).toBe(0);
    expect(body.byReplica).toHaveLength(3);
    const flat = body.byReplica.flatMap(
      (r: { dispatchedEventIds: string[] }) => r.dispatchedEventIds,
    );
    expect(new Set(flat).size).toBe(5);

    const rows = await sql<
      { status: string }[]
    >`SELECT status FROM sim.approval_outbox_events`;
    expect(rows.every((r) => r.status === "dispatched")).toBe(true);

    const log = await sql<
      { n: number }[]
    >`SELECT COUNT(*)::int AS n FROM sim.outbox_consumer_log`;
    expect(log[0].n).toBe(5);
  });

  it("두 번째 dispatch 호출 — 추가 row 없음 (idempotent)", async () => {
    const events = [
      {
        aggregateId: "proj-001",
        eventName: "approval.budget.submitted",
        payload: { idx: 0 },
        occurredAt: 1714250400000,
      },
    ];
    const ins = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: internal,
      payload: { events },
    });
    expect(ins.json().inserted).toBe(1);

    const dis1 = await app.inject({
      method: "POST",
      url: "/admin/outbox/dispatch",
      headers: internal,
      payload: { replicaCount: 3, timeoutMs: 2_000 },
    });
    expect(dis1.json().totalDispatched).toBe(1);

    const dis2 = await app.inject({
      method: "POST",
      url: "/admin/outbox/dispatch",
      headers: internal,
      payload: { replicaCount: 3, timeoutMs: 1_000 },
    });
    const body2 = dis2.json();
    expect(body2.totalDispatched).toBe(0);
    expect(body2.duplicates).toBe(0);
  });
});
