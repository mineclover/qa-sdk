// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.3 — OutboxAdminController + InternalIpGuard 컨트롤러 테스트.
// insert 200 / dispatch 200 / 400 RFC 7807 / 외부 IP 404 silent — 4 케이스.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { OutboxAdminController } from "./outbox-admin.controller.js";
import { OutboxAdminInsertService } from "./outbox-admin-insert.service.js";
import {
  OutboxAdminDispatchService,
  type OutboxAdminDispatcher,
} from "./outbox-admin-dispatch.service.js";
import { OutboxAdminStateQueryService } from "./outbox-admin-state-query.service.js";
import {
  OUTBOX_ADMIN_REPO,
  OUTBOX_DISPATCHER_FACTORY,
  type OutboxAdminRepo,
  type OutboxAdminRepoTx,
} from "./outbox-admin.tokens.js";

const repoStub: OutboxAdminRepo = {
  async transaction<T>(cb: (tx: OutboxAdminRepoTx) => Promise<T>): Promise<T> {
    return cb({
      async insertMany(rows) {
        return rows.map((r) => r.id as string);
      },
    });
  },
};

const factoryStub = (consumerName: string): OutboxAdminDispatcher => {
  const claimed: string[] = [`${consumerName}-evt`];
  return {
    consumerName,
    claimed,
    async tick() {
      return 0;
    },
  };
};

const internal = { "x-forwarded-for": "127.0.0.1" };

describe("OutboxAdminController", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OutboxAdminController],
      providers: [
        OutboxAdminInsertService,
        OutboxAdminDispatchService,
        { provide: OUTBOX_ADMIN_REPO, useValue: repoStub },
        { provide: OUTBOX_DISPATCHER_FACTORY, useValue: factoryStub },
        {
          provide: OutboxAdminStateQueryService,
          useValue: {
            queryState: async () => ({ publishedAt: [], dispatcherIds: [] }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /admin/outbox/insert — 200 + spec §9 shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: internal,
      payload: {
        events: [
          {
            aggregateId: "proj-001",
            eventName: "approval.budget.submitted",
            payload: { amount: 1000 },
            occurredAt: 1714250400000,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ inserted: 1 });
    expect(body.idempotencyKeys).toHaveLength(1);
    expect(body.ids).toHaveLength(1);
  });

  it("POST /admin/outbox/dispatch — 200 + spec §9 shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/dispatch",
      headers: internal,
      payload: { replicaCount: 3, timeoutMs: 100 },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.byReplica).toHaveLength(3);
    expect(b.totalDispatched).toBe(3);
    expect(b.duplicates).toBe(0);
    expect(typeof b.durationMs).toBe("number");
  });

  it("잘못된 body → 400 RFC 7807", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: internal,
      payload: { events: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.type).toMatch(/qa-sdk\.dev\/errors\/validation/);
  });

  it("외부 IP → 404 silent (InternalIpGuard)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: { "x-forwarded-for": "8.8.8.8" },
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(404);
  });
});
