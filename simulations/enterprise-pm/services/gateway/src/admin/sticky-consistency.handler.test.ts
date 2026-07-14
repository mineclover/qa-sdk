// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2 — handler 단위 테스트.
//
// Plan defect note:
//   초안 plan §2.3.1 은 sim-internal-network 에서 `honoInternalIpMiddleware` +
//   `parseCidrList` 를 import 하도록 지시했으나, 실제 export 는 `internalIpMiddleware`
//   (no hono- prefix) 이고 CIDR list 옵션을 받지 않는다 (RFC1918 + loopback hardcoded).
//   본 stage 의 외부 IP 케이스(8.8.8.8) / 내부 IP 케이스(172.17.0.5) 는 모두
//   shared 미들웨어의 hardcoded RFC1918 + loopback CIDRs 로 정상 분기되므로
//   internalCidrs 옵션은 plan 의도와 동일하게 reject + accept 가능. defect log 참조.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createStickyConsistencyHandler } from './sticky-consistency.handler.js';
import { StickyDecisionTracker } from '../routing/sticky-decision-tracker.js';
import { internalIpMiddleware } from 'sim-internal-network';

const NOW = new Date('2026-05-02T01:00:00Z');

function makeApp(tracker: StickyDecisionTracker): Hono {
  const app = new Hono();
  app.use('/admin/*', internalIpMiddleware());
  app.get(
    '/admin/routing/sticky-consistency',
    createStickyConsistencyHandler({ tracker, now: () => NOW }),
  );
  return app;
}

const fire = (app: Hono, ip: string, qs = ''): Promise<Response> =>
  app.fetch(
    new Request(`http://gw/admin/routing/sticky-consistency${qs}`, {
      headers: { 'x-forwarded-for': ip },
    }),
  );

describe('GET /admin/routing/sticky-consistency', () => {
  it('internal + 빈 buffer → 200 ratio=1 sample=0', async () => {
    const r = await fire(makeApp(new StickyDecisionTracker({ maxSize: 100 })), '172.17.0.5');
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      ratio: number;
      sample: number;
      inconsistentUsers: number;
      window: { from: string; to: string };
    };
    expect(body).toMatchObject({ ratio: 1, sample: 0, inconsistentUsers: 0 });
    expect(typeof body.window.from).toBe('string');
    expect(typeof body.window.to).toBe('string');
  });

  it('inconsistent 1명 → ratio≈0.9 sample=11', async () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date('2026-05-02T00:30:00Z');
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, 'v3', at);
    t.record('u-1', 'v4-candidate', at);
    const body = (await (await fire(makeApp(t), '172.17.0.5')).json()) as {
      ratio: number;
      sample: number;
      inconsistentUsers: number;
    };
    expect(body).toMatchObject({ inconsistentUsers: 1, sample: 11 });
    expect(body.ratio).toBeCloseTo(0.9, 5);
  });

  it('외부 IP → 404 silent', async () => {
    const r = await fire(makeApp(new StickyDecisionTracker({ maxSize: 100 })), '8.8.8.8');
    expect(r.status).toBe(404);
  });

  it('?windowMinutes=10 → 윈도우 밖 records 제외', async () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    t.record('u-99', 'v3', new Date(NOW.getTime() - 3600_000));
    t.record('u-99', 'v4-candidate', new Date(NOW.getTime() - 3600_000));
    t.record('u-1', 'v3', new Date(NOW.getTime() - 300_000));
    const body = (await (await fire(makeApp(t), '172.17.0.5', '?windowMinutes=10')).json()) as {
      ratio: number;
      sample: number;
      inconsistentUsers: number;
    };
    expect(body).toMatchObject({ sample: 1, inconsistentUsers: 0, ratio: 1 });
  });

  it('?windowMinutes=-5 → 400 RFC 7807', async () => {
    const r = await fire(
      makeApp(new StickyDecisionTracker({ maxSize: 100 })),
      '172.17.0.5',
      '?windowMinutes=-5',
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { status: number; title?: string };
    expect(body).toMatchObject({ status: 400 });
    expect(body.title).toBeDefined();
  });
});
