// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AdminFaultController, FAULT_INJECTOR_TOKEN } from './admin-fault.controller.js';
import { FaultInjector } from './fault-injector.js';
import type { Fault, FaultKind } from './types.js';

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

describe('AdminFaultController POST /admin/fault/:kind', () => {
  let app: NestFastifyApplication;
  let stub: StubFault;

  beforeEach(async () => {
    stub = new StubFault();
    const injector = new FaultInjector({
      'schema-break': stub,
    } as Record<FaultKind, Fault>);
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminFaultController],
      providers: [{ provide: FAULT_INJECTOR_TOKEN, useValue: injector }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function fastify(): FastifyInjectable {
    return app.getHttpAdapter().getInstance() as unknown as FastifyInjectable;
  }

  it('enabled=true routes params to FaultInjector.enable', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/schema-break',
      payload: { enabled: true, params: { fieldName: 'v2.required' } },
    });
    expect(res.statusCode).toBe(201); // NestJS @Post default 201
    expect(stub.enabled).toBe(true);
    expect(stub.lastParams).toEqual({ fieldName: 'v2.required' });
  });

  it('enabled=false routes to FaultInjector.disable', async () => {
    await stub.enable({});
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/schema-break',
      payload: { enabled: false },
    });
    expect(res.statusCode).toBe(201);
    expect(stub.enabled).toBe(false);
  });

  it('rejects unknown FaultKind with 400', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/unknown-kind',
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects malformed body (missing enabled) with 400', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/schema-break',
      payload: { params: {} },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ----- spec 2026-05-02 §6 신규 2종 (pubsub-invalidate-drop, perf-warn) + §11 RFC 7807 -----
//
// 6 케이스 (Task 1b.5.1):
//   (a) pubsub-invalidate-drop {dropRate:0.5} → 200 + spec §6 shape
//   (b) pubsub-invalidate-drop {dropRate:1.5} → 400 RFC 7807
//   (c) perf-warn {severity:"warn"} → 200
//   (d) perf-warn {severity:"fail"} → 400
//   (e) 기존 schema-break 그대로 동작 (response shape 변경 무회귀)
//   (f) 미등록 kind → 404 (admin-fault-controller 가 enum 검증 후 reject)

import { PubsubInvalidateDropFault } from './pubsub-invalidate-drop.js';
import { PerfWarnFault } from './perf-warn.js';

describe('AdminFaultController spec §6 — 6 kind body schema (Task 1b.5)', () => {
  let app: NestFastifyApplication;
  let pid: PubsubInvalidateDropFault;
  let pw: PerfWarnFault;
  let sb: StubFault;

  beforeEach(async () => {
    pid = new PubsubInvalidateDropFault();
    pw = new PerfWarnFault();
    sb = new StubFault();
    const injector = new FaultInjector({
      'schema-break': sb,
      'pubsub-invalidate-drop': pid,
      'perf-warn': pw,
    } as unknown as Record<FaultKind, Fault>);
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminFaultController],
      providers: [{ provide: FAULT_INJECTOR_TOKEN, useValue: injector }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function fastify(): FastifyInjectable {
    return app.getHttpAdapter().getInstance() as unknown as FastifyInjectable;
  }

  it('(a) POST /admin/fault/pubsub-invalidate-drop {dropRate:0.5} → 201 + spec §6 shape', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/pubsub-invalidate-drop',
      payload: { enabled: true, params: { dropRate: 0.5 } },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: 'pubsub-invalidate-drop',
      active: true,
      params: { dropRate: 0.5 },
    });
    expect(pid.isEnabled()).toBe(true);
    expect(pid.getParams()).toEqual({ dropRate: 0.5 });
  });

  it('(b) POST /admin/fault/pubsub-invalidate-drop {dropRate:1.5} → 400 RFC 7807', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/pubsub-invalidate-drop',
      payload: { enabled: true, params: { dropRate: 1.5 } },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    const detail = (body.message ?? body) as Record<string, unknown>;
    expect(detail.type).toBe('https://qa-sdk.dev/errors/validation');
    expect(detail.status).toBe(400);
  });

  it("(c) POST /admin/fault/perf-warn {severity:'warn'} → 201", async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/perf-warn',
      payload: { enabled: true, params: { severity: 'warn' } },
    });
    expect(res.statusCode).toBe(201);
    expect(pw.isEnabled()).toBe(true);
  });

  it("(d) POST /admin/fault/perf-warn {severity:'fail'} → 400", async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/perf-warn',
      payload: { enabled: true, params: { severity: 'fail' } },
    });
    expect(res.statusCode).toBe(400);
    expect(pw.isEnabled()).toBe(false);
  });

  it('(e) 기존 schema-break 무회귀: spec §6 응답 shape', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/schema-break',
      payload: { enabled: true, params: { fieldName: 'v2.required' } },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: 'schema-break',
      active: true,
    });
    expect(sb.enabled).toBe(true);
  });

  it('(f) 미등록 kind → 400 (zod enum 거부)', async () => {
    const res = await fastify().inject({
      method: 'POST',
      url: '/admin/fault/xyz-unknown',
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
  });
});
