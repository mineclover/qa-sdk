// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import {
  AdminFaultController,
  FAULT_INJECTOR_TOKEN,
} from "./admin-fault.controller.js";
import { FaultInjector } from "./fault-injector.js";
import type { Fault, FaultKind } from "./types.js";

class StubFault implements Fault {
  enabled = false;
  lastParams: unknown = null;
  async enable(p: unknown) {
    this.enabled = true;
    this.lastParams = p;
  }
  async disable() {
    this.enabled = false;
  }
  async reset() {
    this.enabled = false;
  }
}

interface FastifyInjectable {
  inject: (opts: {
    method: string;
    url: string;
    payload?: unknown;
  }) => Promise<{ statusCode: number; payload: string }>;
}

describe("AdminFaultController POST /admin/fault/:kind", () => {
  let app: NestFastifyApplication;
  let stub: StubFault;

  beforeEach(async () => {
    stub = new StubFault();
    const injector = new FaultInjector({
      "schema-break": stub,
    } as Record<FaultKind, Fault>);
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminFaultController],
      providers: [
        { provide: FAULT_INJECTOR_TOKEN, useValue: injector },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function fastify(): FastifyInjectable {
    return app.getHttpAdapter().getInstance() as unknown as FastifyInjectable;
  }

  it("enabled=true routes params to FaultInjector.enable", async () => {
    const res = await fastify().inject({
      method: "POST",
      url: "/admin/fault/schema-break",
      payload: { enabled: true, params: { fieldName: "v2.required" } },
    });
    expect(res.statusCode).toBe(201); // NestJS @Post default 201
    expect(stub.enabled).toBe(true);
    expect(stub.lastParams).toEqual({ fieldName: "v2.required" });
  });

  it("enabled=false routes to FaultInjector.disable", async () => {
    await stub.enable({});
    const res = await fastify().inject({
      method: "POST",
      url: "/admin/fault/schema-break",
      payload: { enabled: false },
    });
    expect(res.statusCode).toBe(201);
    expect(stub.enabled).toBe(false);
  });

  it("rejects unknown FaultKind with 400", async () => {
    const res = await fastify().inject({
      method: "POST",
      url: "/admin/fault/unknown-kind",
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects malformed body (missing enabled) with 400", async () => {
    const res = await fastify().inject({
      method: "POST",
      url: "/admin/fault/schema-break",
      payload: { params: {} },
    });
    expect(res.statusCode).toBe(400);
  });
});
