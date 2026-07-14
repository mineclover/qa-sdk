// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 9~11 — admin/scale 3 endpoint.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.8
//
// 7 케이스:
//   (a) GET /admin/scale/pin 빈 store → { pins: {} }
//   (b) POST /admin/scale/pin {service:"x",replicas:3} → {service:"x",replicas:3}
//   (c) 같은 service 재 pin → 409
//   (d) replicas 미명시 (unpin) → {service:"x",replicas:null}
//   (e) /admin/scale/replicas source 미명시 → 400
//   (f) compose exec 성공 → prev/new replicas
//   (g) compose exec 실패 → 500

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AdminScaleController } from './scale.controller.js';
import { ScaleStore } from './scale-store.js';
import { ScalePinService } from './scale-pin.service.js';
import {
  COMPOSE_EXEC_TOKEN,
  SIM_COMPOSE_PROJECT_TOKEN,
  type ComposeExec,
} from './compose-proxy.controller.js';

const internal = { 'x-forwarded-for': '172.20.0.5', 'content-type': 'application/json' };

describe('AdminScaleController (spec §6 endpoints 9~11)', () => {
  let app: NestFastifyApplication;
  let pin: ScalePinService;
  let exec: ComposeExec & { mock: { calls: unknown[][] } };

  async function bootstrap(execImpl: ComposeExec): Promise<void> {
    const store = new ScaleStore();
    pin = new ScalePinService(store);
    exec = vi.fn(execImpl) as unknown as ComposeExec & { mock: { calls: unknown[][] } };
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AdminScaleController],
      providers: [
        { provide: ScaleStore, useValue: store },
        { provide: ScalePinService, useValue: pin },
        { provide: COMPOSE_EXEC_TOKEN, useValue: exec },
        { provide: SIM_COMPOSE_PROJECT_TOKEN, useValue: 'enterprise-pm' },
      ],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  it('(a) GET /admin/scale/pin 빈 store → { pins: {} }', async () => {
    await bootstrap(async () => ({ stdout: '', stderr: '' }));
    const res = await app.inject({
      method: 'GET',
      url: '/admin/scale/pin',
      headers: internal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pins: {} });
  });

  it('(b) POST /admin/scale/pin {service,replicas:3} → {service, replicas:3}', async () => {
    await bootstrap(async () => ({ stdout: '', stderr: '' }));
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/pin',
      headers: internal,
      payload: { service: 'sim-approval-api-v2', replicas: 3 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      service: 'sim-approval-api-v2',
      replicas: 3,
    });
    expect(pin.getPin('sim-approval-api-v2')).toBe(3);
  });

  it('(c) 같은 service 재 pin → 409', async () => {
    await bootstrap(async () => ({ stdout: '', stderr: '' }));
    pin.pin('sim-approval-api-v2', 3);
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/pin',
      headers: internal,
      payload: { service: 'sim-approval-api-v2', replicas: 5 },
    });
    expect(res.statusCode).toBe(409);
  });

  it('(d) replicas 미명시 (unpin) → {service, replicas: null}', async () => {
    await bootstrap(async () => ({ stdout: '', stderr: '' }));
    pin.pin('sim-approval-api-v2', 3);
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/pin',
      headers: internal,
      payload: { service: 'sim-approval-api-v2' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      service: 'sim-approval-api-v2',
      replicas: null,
    });
    expect(pin.getPin('sim-approval-api-v2')).toBeNull();
  });

  it('(e) /admin/scale/replicas source 미명시 → 400', async () => {
    await bootstrap(async () => ({ stdout: '', stderr: '' }));
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/replicas',
      headers: internal,
      payload: { service: 'sim-approval-api-v1', replicas: 3 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('(f) compose exec 성공 → prev/new replicas', async () => {
    // 첫 호출 (probeReplicas) → v1=1 running. 두 번째 호출 (--scale) → 빈 stdout.
    let call = 0;
    await bootstrap(async () => {
      call += 1;
      if (call === 1) {
        return {
          stdout: JSON.stringify({
            Service: 'sim-approval-api-v1',
            State: 'running',
          }),
          stderr: '',
        };
      }
      return { stdout: '', stderr: '' };
    });
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/replicas',
      headers: internal,
      payload: {
        service: 'sim-approval-api-v1',
        replicas: 3,
        source: 'operator',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      service: 'sim-approval-api-v1',
      prevReplicas: 1,
      newReplicas: 3,
    });
  });

  it('(g) compose exec 실패 → 500', async () => {
    let call = 0;
    await bootstrap(async () => {
      call += 1;
      if (call === 1) return { stdout: '', stderr: '' };
      throw new Error('docker daemon unreachable');
    });
    const res = await app.inject({
      method: 'POST',
      url: '/admin/scale/replicas',
      headers: internal,
      payload: {
        service: 'sim-approval-api-v1',
        replicas: 3,
        source: 'operator',
      },
    });
    expect(res.statusCode).toBe(500);
  });
});
