// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * spec 04 §3.5 — bitmap_cache_lookup_total 카운터.
 *
 * `getBitmap` 결과(hit | miss | version_mismatch)별로 누적. version_mismatch
 * 비율 비정상은 catalog 측 prefix 변동 빈도 이상 신호(spec 04 §3.5).
 */

import { Counter, register } from 'prom-client';

export const BITMAP_CACHE_LOOKUP_RESULTS = ['hit', 'miss', 'version_mismatch'] as const;
export type BitmapCacheLookupResult = (typeof BITMAP_CACHE_LOOKUP_RESULTS)[number];

/**
 * 글로벌 default registry에 등록 — 서비스(approval-api 등)의 `/metrics`
 * 엔드포인트가 자동으로 노출.
 */
export const bitmapCacheLookupTotal = new Counter({
  name: 'bitmap_cache_lookup_total',
  help: 'BitmapCacheService.getBitmap 호출 결과 분포 (spec 04 §3.5)',
  labelNames: ['result'] as const,
  registers: [register],
});

export function recordBitmapCacheLookup(result: BitmapCacheLookupResult): void {
  if (!BITMAP_CACHE_LOOKUP_RESULTS.includes(result)) {
    throw new Error(`invalid bitmap cache lookup result: ${String(result)}`);
  }
  bitmapCacheLookupTotal.inc({ result }, 1);
}
