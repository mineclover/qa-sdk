// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from 'vitest';
import { InMemoryRoutingStore, RouteEntrySchema, type RouteEntry } from './routing-table.js';

const base: RouteEntry = {
  revision: 1,
  stable: { version: 'v3', upstream: 'http://sim-approval-api-v1:4500' },
  candidate: null,
  weight: 0,
  stickyKey: 'user_id',
};

describe('InMemoryRoutingStore', () => {
  it('getRoute undefined when unknown; first upsert always applies', () => {
    const s = new InMemoryRoutingStore();
    expect(s.getRoute('x')).toBeUndefined();
    expect(s.upsertRoute('x', { ...base, revision: 17 }).applied).toBe(true);
    expect(s.getRoute('x')?.revision).toBe(17);
  });

  it('revision staleness: greater overwrites; equal/smaller silent-drop', () => {
    const s = new InMemoryRoutingStore();
    s.upsertRoute('x', { ...base, revision: 5 });
    expect(s.upsertRoute('x', { ...base, revision: 6, weight: 10 }).applied).toBe(true);
    expect(s.upsertRoute('x', { ...base, revision: 6, weight: 99 }).applied).toBe(false);
    expect(s.upsertRoute('x', { ...base, revision: 5, weight: 99 }).applied).toBe(false);
    expect(s.getRoute('x')?.weight).toBe(10);
  });

  it('dump snapshot is isolated (mutation does not leak)', () => {
    const s = new InMemoryRoutingStore();
    s.upsertRoute('x', base);
    const snap = s.dump();
    snap.routes['x']!.weight = 100;
    expect(s.getRoute('x')?.weight).toBe(0);
  });

  it('RouteEntrySchema rejects weight out of [0,100] and non-user_id stickyKey', () => {
    expect(() => RouteEntrySchema.parse({ ...base, weight: 101 })).toThrow();
    expect(() => RouteEntrySchema.parse({ ...base, weight: -1 })).toThrow();
    expect(() => RouteEntrySchema.parse({ ...base, stickyKey: 'session_id' as never })).toThrow();
  });
});
