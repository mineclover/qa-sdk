// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 4~6 + InternalIpGuard (§3) 통합 테스트.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.1
//
// 4 케이스:
//   (a) /v1/alerts/count?kind=...                → ring buffer count
//   (b) /v1/audit/trace?cycleId=01HXNOTFOUND     → 404 RFC 7807
//   (c) /v1/catalog/states?prefix=sim.svc.x      → catalog topology
//   (d) external IP                              → 404 silent (InternalIpGuard)

import { describe, it, expect, beforeEach } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import {
  AlertsAuditCatalogController,
  SIM_SERVICE_CATALOG_TOKEN,
  type SimServiceCatalogPort,
} from "./alerts-audit-catalog.controller.js";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";
import type { AlertEventRecordInput } from "sim-decision-view";

const internal = { "x-forwarded-for": "172.17.0.5" };

function alert(
  kind: string,
  cycleId: string,
  occurredAt = "2026-05-02T10:00:00.000Z",
): AlertEventRecordInput {
  return { cycleId, kind, occurredAt };
}

describe("AlertsAuditCatalogController (spec §6 endpoints 4/5/6)", () => {
  let app: NestFastifyApplication;
  let rb: DecisionRingBuffer;
  let catalog: SimServiceCatalogPort;

  beforeEach(async () => {
    rb = new DecisionRingBuffer({ maxSize: 100 });
    catalog = {
      getCurrentTopology: async () => ({
        stable: { value: 1 },
        candidate: { value: 2 },
        retired: [],
      }),
    };
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AlertsAuditCatalogController],
      providers: [
        { provide: DecisionRingBuffer, useValue: rb },
        { provide: SIM_SERVICE_CATALOG_TOKEN, useValue: catalog },
      ],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it("(a) GET /v1/alerts/count returns ring buffer count", async () => {
    rb.appendAlert(alert("scale-up-rejected", "C1"));
    rb.appendAlert(alert("scale-up-rejected", "C2"));
    rb.appendAlert(alert("scale-up-rejected", "C3"));
    rb.appendAlert(alert("other-kind", "C4"));
    const res = await app.inject({
      method: "GET",
      url: "/v1/alerts/count?kind=scale-up-rejected",
      headers: internal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 3, kind: "scale-up-rejected" });
  });

  it("(b) GET /v1/audit/trace?cycleId=01HXNOTFOUND → 404 RFC 7807", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/audit/trace?cycleId=01HXNOTFOUND",
      headers: internal,
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as Record<string, unknown>;
    // NestJS HttpException wraps RFC 7807 payload — both spread + nested in `message` are acceptable
    const detail = (body.message ?? body) as Record<string, unknown>;
    expect(detail.type).toBe("https://qa-sdk.dev/errors/not-found");
    expect(detail.status).toBe(404);
  });

  it("(c) GET /v1/catalog/states maps catalog topology", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/catalog/states?prefix=sim.svc.approval",
      headers: internal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      stable: { value: 1 },
      candidate: { value: 2 },
      retired: [],
    });
  });

  it("(d) external IP → 404 silent (InternalIpGuard)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/alerts/count?kind=any",
      headers: { "x-forwarded-for": "8.8.8.8" },
    });
    expect(res.statusCode).toBe(404);
  });
});
