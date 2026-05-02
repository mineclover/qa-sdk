// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.7 — sim-handles ↔ endpoint contract.
// sim-outbox-view 패키지가 SSOT — controller 응답이 schema 와 typecheck 시점에서 일치해야 한다.
// runtime 검증은 zod parse 로 강제.

import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import {
  OutboxInsertResponseSchema,
  OutboxDispatchResponseSchema,
  type OutboxInsertResponse,
  type OutboxDispatchResponse,
} from "sim-outbox-view";
import { OutboxAdminController } from "./outbox-admin.controller.js";
import { OutboxAdminInsertService } from "./outbox-admin-insert.service.js";
import {
  OutboxAdminDispatchService,
  type OutboxAdminDispatcher,
  type OutboxDispatcherFactory,
} from "./outbox-admin-dispatch.service.js";
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

const internal = { "x-forwarded-for": "127.0.0.1" };

async function bootApp(
  factory: OutboxDispatcherFactory,
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [OutboxAdminController],
    providers: [
      OutboxAdminInsertService,
      OutboxAdminDispatchService,
      { provide: OUTBOX_ADMIN_REPO, useValue: repoStub },
      { provide: OUTBOX_DISPATCHER_FACTORY, useValue: factory },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe("OutboxAdmin sim-handles contract", () => {
  it("insert 응답이 sim-outbox-view OutboxInsertResponse shape 일치", async () => {
    const factory = (consumerName: string): OutboxAdminDispatcher => ({
      consumerName,
      claimed: [],
      async tick() {
        return 0;
      },
    });
    const app = await bootApp(factory);
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/insert",
      headers: internal,
      payload: {
        events: [
          {
            aggregateId: "proj-001",
            eventName: "approval.budget.submitted",
            payload: {},
            occurredAt: 1714250400000,
          },
        ],
      },
    });
    // compile-time contract — TS 가 type mismatch 를 잡으면 contract 위반.
    const body: OutboxInsertResponse = res.json();
    // runtime contract — zod parse 로 shape 강제.
    expect(OutboxInsertResponseSchema.parse(body)).toEqual(body);
    await app.close();
  });

  it("dispatch 응답이 sim-outbox-view OutboxDispatchResponse shape 일치", async () => {
    const factory = (consumerName: string): OutboxAdminDispatcher => ({
      consumerName,
      claimed: [`${consumerName}-evt`],
      async tick() {
        return 0;
      },
    });
    const app = await bootApp(factory);
    const res = await app.inject({
      method: "POST",
      url: "/admin/outbox/dispatch",
      headers: internal,
      payload: { replicaCount: 2, timeoutMs: 100 },
    });
    const body: OutboxDispatchResponse = res.json();
    expect(OutboxDispatchResponseSchema.parse(body)).toEqual(body);
    expect(body.totalDispatched).toBe(2);
    expect(body.duplicates).toBe(0);
    await app.close();
  });
});
