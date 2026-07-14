// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from 'vitest';
import { decideRoute, type RouteEntry } from './route-decision.js';

const stableOnly: RouteEntry = {
  revision: 1,
  stable: { version: 'v3', upstream: 'http://sim-approval-api-v1:4500' },
  candidate: null,
  weight: 0,
  stickyKey: 'user_id',
};
const wc: RouteEntry = {
  ...stableOnly,
  revision: 2,
  candidate: { version: 'v4-candidate', upstream: 'http://sim-approval-api-v2:4500' },
  weight: 10,
};

describe('decideRoute (spec §3.1/§3.3)', () => {
  it('no candidate / anonymous / weight=0 → stable (no-candidate, anonymous, rollback)', () => {
    expect(decideRoute({ entry: stableOnly, userId: 'u' }).reason).toBe('no-candidate');
    expect(decideRoute({ entry: wc, userId: undefined }).reason).toBe('anonymous');
    expect(decideRoute({ entry: { ...wc, weight: 0 }, userId: 'u' }).reason).toBe('rollback');
  });

  it('weight=100 → candidate for any userId', () => {
    expect(decideRoute({ entry: { ...wc, weight: 100 }, userId: 'x' }).target).toBe('candidate');
  });

  it('weight=50 → ~50% candidate over 1000 users', () => {
    const half: RouteEntry = { ...wc, weight: 50 };
    let cand = 0;
    for (let i = 0; i < 1000; i++) {
      if (decideRoute({ entry: half, userId: `u-${i}` }).target === 'candidate') cand++;
    }
    expect(cand).toBeGreaterThan(400);
    expect(cand).toBeLessThan(600);
  });
});

// spec 2026-05-02 §9 Stage 2 — sticky tracker DI wrapper.
import { StickyDecisionTracker } from './sticky-decision-tracker.js';
import { decideRouteWithTracking } from './route-decision.js';

describe('decideRouteWithTracking (Stage 2 — tracker DI)', () => {
  const entry: RouteEntry = {
    revision: 1,
    stable: { version: 'v3', upstream: 'http://sim-approval-api-v1:4500' },
    candidate: { version: 'v4-candidate', upstream: 'http://sim-approval-api-v2:4500' },
    weight: 50,
    stickyKey: 'user_id',
  };

  it('결정된 version으로 tracker.record 호출됨', () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date('2026-05-02T00:00:00Z');
    decideRouteWithTracking({ tracker, entry, userId: 'u-42', now: at });
    const all = tracker.dump();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ userId: 'u-42', at });
    expect(['v3', 'v4-candidate']).toContain(all[0]?.version);
  });

  it('tracker undefined → record 생략 (legacy compat)', () => {
    const r = decideRouteWithTracking({
      tracker: undefined,
      entry,
      userId: 'u-1',
      now: new Date(),
    });
    expect(['v3', 'v4-candidate']).toContain(r.version);
  });

  it('anonymous (userId undefined) → record 생략', () => {
    const tracker = new StickyDecisionTracker({ maxSize: 100 });
    decideRouteWithTracking({
      tracker,
      entry,
      userId: undefined,
      now: new Date(),
    });
    expect(tracker.dump()).toHaveLength(0);
  });
});
