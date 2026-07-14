// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2 — sticky decision ring buffer 단위 테스트.

import { describe, it, expect } from 'vitest';
import { StickyDecisionTracker } from './sticky-decision-tracker.js';

describe('StickyDecisionTracker', () => {
  it('ring eviction: maxSize 초과 시 오래된 것 폐기', () => {
    const t = new StickyDecisionTracker({ maxSize: 3 });
    const at = new Date('2026-05-02T00:00:00Z');
    for (let i = 0; i < 5; i++) {
      t.record(`u-${i}`, 'v3', new Date(at.getTime() + i * 1000));
    }
    expect(t.dump().map((d) => d.userId)).toEqual(['u-2', 'u-3', 'u-4']);
  });

  it('전 user 단일 version → ratio=1', () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, 'v3', new Date());
    expect(t.getRatio()).toMatchObject({
      ratio: 1,
      sample: 10,
      inconsistentUsers: 0,
    });
  });

  it('inconsistent 1명 → ratio≈0.9', () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const at = new Date();
    for (let i = 0; i < 10; i++) t.record(`u-${i}`, 'v3', at);
    t.record('u-1', 'v4-candidate', new Date(at.getTime() + 1000));
    const r = t.getRatio();
    expect(r.inconsistentUsers).toBe(1);
    expect(r.ratio).toBeCloseTo(0.9, 5);
  });

  it('getInconsistentUsers + window 적용', () => {
    const t = new StickyDecisionTracker({ maxSize: 100 });
    const t0 = new Date('2026-05-02T00:00:00Z');
    t.record('u-1', 'v3', t0);
    t.record('u-1', 'v4-candidate', new Date(t0.getTime() + 60_000));
    t.record('u-2', 'v3', t0);
    expect(t.getInconsistentUsers()).toEqual(['u-1']);
    expect(
      t.getInconsistentUsers({
        from: t0,
        to: new Date(t0.getTime() + 30_000),
      }),
    ).toEqual([]);
  });

  it('empty buffer → ratio 1, sample 0', () => {
    expect(new StickyDecisionTracker({ maxSize: 100 }).getRatio()).toMatchObject({
      ratio: 1,
      sample: 0,
      inconsistentUsers: 0,
    });
  });
});
