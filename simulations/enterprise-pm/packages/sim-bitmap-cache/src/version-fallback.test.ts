// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * spec 04 §3.4 시나리오 #16 (`bitmap-cache-version-fallback`) 핵심 메커니즘
 * 단위 테스트 — fault injection은 in-memory(=pub/sub 미주입). publish 100% drop
 * 상태에서 prefixVersion bump 후 (a) TTL 만료 이전 version-check fallthrough,
 * (b) TTL 만료 후 fallthrough 두 경로 모두 회복됨을 단정한다.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { register } from "prom-client";
import { BitmapCacheService } from "./cache-service.js";
import {
  DEFAULT_BITMAP_TTL_MS,
  type BitmapCacheEntry,
} from "./lru-cache.js";
import { bitmapCacheLookupTotal } from "./metrics.js";

const KEY = "bitmap:user:U001:sim.svc.approval:v3";
const PREFIX = "sim.svc.approval";

const fixedEntry = (
  over: Partial<BitmapCacheEntry> = {},
): BitmapCacheEntry => ({
  key: KEY,
  prefix: PREFIX,
  prefixVersion: "v3",
  mask: new Uint8Array([0x01, 0x02]),
  issuedAt: Date.now(),
  ttlMs: DEFAULT_BITMAP_TTL_MS,
  ...over,
});

const silent = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

/** version mutable한 catalog mock — pub/sub은 미주입(=100% drop 효과). */
function setup(initialVer: string) {
  let current = initialVer;
  const catalog = {
    bump: (next: string): void => {
      current = next;
    },
    getLatestPrefixVersion: vi.fn(async () => current),
  };
  const fetchBitmap = vi.fn(async () => ({
    prefix: PREFIX,
    prefixVersion: current,
    mask: new Uint8Array([0xab]),
  }));
  const svc = new BitmapCacheService({
    publisherName: "test",
    cache: { max: 100 },
    logger: silent(),
    catalog,
    authApi: { fetchBitmap },
  });
  return { svc, catalog, fetchBitmap };
}

describe("bitmap version-check fallback (spec 04 §3 — pub/sub drop 회복)", () => {
  beforeEach(() => {
    bitmapCacheLookupTotal.reset();
  });

  it("pub/sub 100% drop + version bump → TTL 만료 이전이라도 version-check fallthrough", async () => {
    const { svc, catalog, fetchBitmap } = setup("v3");
    svc.cache.setEntry(fixedEntry());
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0x01, 0x02])); // (1) hit
    expect(fetchBitmap).not.toHaveBeenCalled();
    catalog.bump("v4"); // pub/sub drop — subscriber 미도달
    await svc.getBitmap(KEY); // version mismatch → §3.2 fallthrough
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
    expect(svc.cache.getEntry(KEY)?.prefixVersion).toBe("v4");
  });

  it("pub/sub 100% drop + TTL 만료 → §3.2 (2) fallthrough", async () => {
    const { svc, fetchBitmap } = setup("v3");
    svc.cache.setEntry(
      fixedEntry({
        issuedAt: Date.now() - DEFAULT_BITMAP_TTL_MS - 1,
        ttlMs: 1,
      }),
    );
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xab]));
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
  });

  it("회복 경로 메트릭 — version_mismatch + miss 라벨 모두 증가", async () => {
    const { svc: a, catalog } = setup("v3");
    a.cache.setEntry(fixedEntry());
    catalog.bump("v4");
    await a.getBitmap(KEY); // version_mismatch → fallthrough → fetch
    const { svc: b } = setup("v3");
    await b.getBitmap(KEY); // miss → fetch
    const out = await register.getSingleMetricAsString(
      "bitmap_cache_lookup_total",
    );
    expect(out).toMatch(/result="version_mismatch"\} 1/);
    expect(out).toMatch(/result="miss"\} 1/);
  });
});
