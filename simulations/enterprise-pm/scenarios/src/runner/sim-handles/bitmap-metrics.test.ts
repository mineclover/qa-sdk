// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createBitmapMetrics, parsePrometheusMetric, type FetchLike } from './bitmap-metrics.js';

const SAMPLE_METRICS = `
# HELP bitmap_cache_lookup_total cache lookups
# TYPE bitmap_cache_lookup_total counter
bitmap_cache_lookup_total{role="admin"} 100
bitmap_cache_lookup_total{role="user"} 200
# HELP bitmap_cache_deny_total deny lookups
bitmap_cache_deny_total 30
# HELP bitmap_cache_ttl_ms ttl
# TYPE bitmap_cache_ttl_ms gauge
bitmap_cache_ttl_ms 5000
`.trim();

describe('bitmap-metrics', () => {
  it('parsePrometheusMetric이 같은 metric 다중 label을 sum', () => {
    expect(parsePrometheusMetric(SAMPLE_METRICS, 'bitmap_cache_lookup_total')).toBe(300);
    expect(parsePrometheusMetric(SAMPLE_METRICS, 'bitmap_cache_deny_total')).toBe(30);
    expect(parsePrometheusMetric(SAMPLE_METRICS, 'bitmap_cache_ttl_ms')).toBe(5000);
  });

  it('parsePrometheusMetric이 미존재 metric에 throw', () => {
    expect(() => parsePrometheusMetric(SAMPLE_METRICS, 'nonexistent')).toThrow(/not found/);
  });

  it('denyRate = deny / lookup', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return SAMPLE_METRICS;
      },
    });
    const m = createBitmapMetrics({
      authApiUrl: 'http://auth/',
      fetchImpl,
    });
    expect(await m.denyRate()).toBeCloseTo(30 / 300, 5);
  });

  it('bitmapTtlMs가 ttl gauge 반환', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return SAMPLE_METRICS;
      },
    });
    const m = createBitmapMetrics({
      authApiUrl: 'http://auth',
      fetchImpl,
    });
    expect(await m.bitmapTtlMs()).toBe(5000);
  });

  it('non-2xx 응답에 throw', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 500,
      async text() {
        return 'down';
      },
    });
    const m = createBitmapMetrics({
      authApiUrl: 'http://auth',
      fetchImpl,
    });
    await expect(m.bitmapTtlMs()).rejects.toThrow(/status=500/);
  });

  it('lookup_total=0이면 denyRate=0 (NaN 회피)', async () => {
    const empty = `bitmap_cache_lookup_total 0\nbitmap_cache_deny_total 0\nbitmap_cache_ttl_ms 1000`;
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return empty;
      },
    });
    const m = createBitmapMetrics({
      authApiUrl: 'http://auth',
      fetchImpl,
    });
    expect(await m.denyRate()).toBe(0);
  });
});
