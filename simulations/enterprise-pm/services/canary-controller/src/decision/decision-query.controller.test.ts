// @def.boundary sim-canary-controller
// spec 2026-05-02 §3·§6 — DecisionQueryController + InternalIpGuard 통합 테스트.

import { describe, it, expect, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { DecisionQueryController } from './decision-query.controller.js';
import { DecisionRingBuffer } from './decision-ring-buffer.js';
import type { SafetyDecisionRecordInput } from 'sim-decision-view';

const C = (n: number) => `sim.cyc.01HXYZ000000000000000${n}`;
function s(
  cId: string,
  verdict: 'promote' | 'rollback' = 'promote',
  at = '2026-05-02T10:00:00.000Z',
): SafetyDecisionRecordInput {
  return {
    decisionId: `sim.dec.safety.${cId.replace('sim.cyc.', '')}`,
    cycleId: cId,
    pass: 'safety',
    verdict,
    cycleAt: at,
    triggerSignals: [],
    confidence: 0.9,
    categoryVerdicts: {
      perf: 'PASS',
      compatibility: 'PASS',
      decisionQuality: 'PASS',
      auditSafety: 'PASS',
      replicationHealth: 'PASS',
    },
  };
}

describe('DecisionQueryController (spec §6)', () => {
  let app: NestFastifyApplication;
  let rb: DecisionRingBuffer;
  beforeEach(async () => {
    rb = new DecisionRingBuffer({ maxSize: 100 });
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [DecisionQueryController],
      providers: [{ provide: DecisionRingBuffer, useValue: rb }],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  const fire = (url: string, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'GET',
      url,
      headers: { 'x-forwarded-for': '172.17.0.5', ...headers },
    });

  it('3 endpoint × (200/필터/400/first null/cycles 최신순/외부 IP 404)', async () => {
    rb.appendSafety(s(C(1), 'promote', '2026-05-02T10:00:00.000Z'));
    rb.appendSafety(s(C(2), 'rollback', '2026-05-02T10:00:30.000Z'));
    rb.appendSafety(s(C(3), 'promote', '2026-05-02T10:01:00.000Z'));
    const all = (await fire('/v1/decisions?pass=safety')).json() as {
      items: { cycleId: string }[];
    };
    expect(all.items).toHaveLength(3);
    expect(all.items[0]).not.toHaveProperty('evidence');
    const filt = (await fire('/v1/decisions?pass=safety&verdict=rollback&limit=10')).json() as {
      items: { verdict: string }[];
    };
    expect(filt.items[0].verdict).toBe('rollback');
    expect((await fire('/v1/decisions?pass=invalid')).statusCode).toBe(400);
    const fst = (await fire('/v1/decisions/first?pass=safety&verdict=rollback')).json() as {
      item: { cycleId: string };
    };
    expect(fst.item.cycleId).toBe(C(2));
    expect(
      (
        (await fire('/v1/decisions/first?pass=resource')).json() as {
          item: unknown;
        }
      ).item,
    ).toBeNull();
    const recent = (await fire('/v1/cycles/recent?limit=2')).json() as {
      cycleIds: string[];
      total: number;
    };
    expect(recent.cycleIds).toEqual([C(3), C(2)]);
    expect(recent.total).toBe(3);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/v1/decisions?pass=safety',
          headers: { 'x-forwarded-for': '8.8.8.8' },
        })
      ).statusCode,
    ).toBe(404);
  });
});
