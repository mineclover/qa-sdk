// @def.boundary sim-canary-controller
// spec 2026-05-02 §3·§6 — Stage 1b 통합 wiring smoke.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.11
//
// 3 케이스:
//   (a) AppModule build + init 후 internal IP /v1/alerts/count → 200
//   (b) external IP → 404 (global InternalIpGuard)
//   (c) /admin/scale/pin GET 빈 store → 200 + { pins: {} }
//
// 본 테스트는 NestJS Test module 로 AppModule 전체를 부팅한다 (요구사항: 모든 의존이
// 정상 wire 되었는지 type 단계에서 강제). config 파일 의존 (controller-config.yaml,
// 외부 URL) 은 process.env 로 주입.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';

// 테스트용 controller-config.yaml 생성 (DecisionModule loadConfig 가 read).
const tmpDir = join(tmpdir(), `sim-canary-controller-${Date.now()}`);
mkdirSync(tmpDir, { recursive: true });
const configPath = join(tmpDir, 'controller-config.yaml');
writeFileSync(
  configPath,
  `
perf:
  errorRate: { warn: 0.012, fail: 0.015, baselineMultiplier: true }
  p95LatencyDelta: { warn: 0.2, fail: 0.5 }
decisionQuality:
  denyRateDelta: { warn: 0.05, fail: 0.15 }
  avgConfidenceDelta: { warn: 0.05, fail: 0.15 }
replicationHealth:
  replicationLagMs: { warn: 500, fail: 2000 }
window: { rollingCycles: 10, failQuorum: 3 }
dwell: { promotionMs: 60000 }
confidence: { holdThreshold: 0.8 }
weightSequence: [0, 5, 25, 50, 100]
`,
);
process.env.SIM_CONTROLLER_CONFIG_PATH = configPath;
process.env.SIM_DB_WRITE_URL = 'http://localhost:5432/test';
process.env.SIM_METRICS_COLLECTOR_URL = 'http://localhost:9090';
process.env.QA_INGEST_URL = 'http://localhost:3200';
process.env.SIM_AUDIT_RECORDER_URL = 'http://localhost:5400';
process.env.SIM_GATEWAY_ADMIN_URL = 'http://localhost:8888';

describe('Stage 1b AppModule wiring smoke (Task 1b.11)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // metrics-scrape / advisory-lock 외부 호출 방지 — fetch 를 noop 으로 mock.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    const { AppModule } = await import('../app.module.js');
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    vi.unstubAllGlobals();
  });

  it('(a) internal IP → /v1/alerts/count 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/alerts/count?kind=scale-up-rejected',
      headers: { 'x-forwarded-for': '172.20.0.5' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      count: 0,
      kind: 'scale-up-rejected',
    });
  });

  it('(b) external IP → 404 (InternalIpGuard)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/alerts/count?kind=any',
      headers: { 'x-forwarded-for': '8.8.8.8' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('(c) /admin/scale/pin GET 빈 store → { pins: {} }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/scale/pin',
      headers: { 'x-forwarded-for': '172.20.0.5' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pins: {} });
  });
});
