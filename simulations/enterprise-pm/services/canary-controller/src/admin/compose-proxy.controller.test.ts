// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 8 — GET /admin/compose/replicas + InternalIpGuard (§3).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.6
//
// 4 케이스:
//   (a) compose ps mock 이 v1 1건 + v2 2건 → { services: { v1: 1, v2: 2 } }
//   (b) docker exec 실패 → 500 RFC 7807
//   (c) 외부 IP → 404 (InternalIpGuard)
//   (d) docker compose v2.18 이하 단일 array 응답 형식 호환

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import {
  AdminComposeProxyController,
  type ComposeExec,
  COMPOSE_EXEC_TOKEN,
  SIM_COMPOSE_PROJECT_TOKEN,
} from './compose-proxy.controller.js';

const internal = { 'x-forwarded-for': '172.20.0.5' };

describe('AdminComposeProxyController GET /admin/compose/replicas (spec §6 endpoint 8)', () => {
  let app: NestFastifyApplication;
  let composeExec: ComposeExec;

  async function bootstrap(exec: ComposeExec): Promise<void> {
    composeExec = exec;
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AdminComposeProxyController],
      providers: [
        { provide: COMPOSE_EXEC_TOKEN, useValue: composeExec },
        { provide: SIM_COMPOSE_PROJECT_TOKEN, useValue: 'enterprise-pm' },
      ],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  it('(a) Compose v2.20+ line-delimited JSON 합산', async () => {
    const exec = vi.fn(async () => ({
      stdout: [
        { Service: 'sim-approval-api-v1', State: 'running' },
        { Service: 'sim-approval-api-v2', State: 'running' },
        { Service: 'sim-approval-api-v2', State: 'running' },
      ]
        .map((o) => JSON.stringify(o))
        .join('\n'),
      stderr: '',
    }));
    await bootstrap(exec);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/compose/replicas',
      headers: internal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      services: {
        'sim-approval-api-v1': 1,
        'sim-approval-api-v2': 2,
      },
    });
    expect(exec).toHaveBeenCalledWith(['compose', '-p', 'enterprise-pm', 'ps', '--format', 'json']);
  });

  it('(b) docker exec 실패 → 500 RFC 7807', async () => {
    const exec = vi.fn(async () => {
      throw new Error('docker daemon unreachable');
    });
    await bootstrap(exec);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/compose/replicas',
      headers: internal,
    });
    expect(res.statusCode).toBe(500);
    const body = res.json() as Record<string, unknown>;
    const detail = (body.message ?? body) as Record<string, unknown>;
    expect(detail.type).toBe('https://qa-sdk.dev/errors/store-failure');
    expect(detail.status).toBe(500);
  });

  it('(c) external IP → 404 (InternalIpGuard)', async () => {
    const exec = vi.fn();
    await bootstrap(exec);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/compose/replicas',
      headers: { 'x-forwarded-for': '8.8.8.8' },
    });
    expect(res.statusCode).toBe(404);
    expect(exec).not.toHaveBeenCalled();
  });

  it('(d) Compose v2.18- single-array JSON 호환', async () => {
    const exec = vi.fn(async () => ({
      stdout: JSON.stringify([
        { Service: 'sim-approval-api-v1', State: 'running' },
        { Service: 'sim-approval-api-v2', State: 'running' },
      ]),
      stderr: '',
    }));
    await bootstrap(exec);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/compose/replicas',
      headers: internal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      services: {
        'sim-approval-api-v1': 1,
        'sim-approval-api-v2': 1,
      },
    });
  });
});
