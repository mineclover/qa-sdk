// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, beforeEach } from 'vitest';
import { register } from 'prom-client';
import {
  recordBitmapCacheLookup,
  bitmapCacheLookupTotal,
  type BitmapCacheLookupResult,
} from './metrics.js';

describe('bitmap_cache_lookup_total counter (spec 04 §3.5)', () => {
  beforeEach(() => {
    bitmapCacheLookupTotal.reset();
  });
  it('counter 이름은 spec 04 §3.5 — bitmap_cache_lookup_total', async () => {
    const out = await register.getSingleMetricAsString('bitmap_cache_lookup_total');
    expect(out).toContain('bitmap_cache_lookup_total');
  });
  it('result 라벨 3종 (hit/miss/version_mismatch) 모두 증가', async () => {
    const cases: BitmapCacheLookupResult[] = ['hit', 'miss', 'version_mismatch'];
    for (const r of cases) recordBitmapCacheLookup(r);
    const out = await register.getSingleMetricAsString('bitmap_cache_lookup_total');
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="hit"\} 1/);
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="miss"\} 1/);
    expect(out).toMatch(/bitmap_cache_lookup_total\{result="version_mismatch"\} 1/);
  });
  it('invalid result 라벨 → 런타임 가드', () => {
    // @ts-expect-error 의도적 부적합
    expect(() => recordBitmapCacheLookup('bogus')).toThrow();
  });
});
