// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { BitmapCacheService } from './cache-service.js';
import { BitmapLruCache, DEFAULT_BITMAP_TTL_MS, type BitmapCacheEntry } from './lru-cache.js';

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const KEY = 'bitmap:user:U001:sim.svc.approval:v3';
const PREFIX = 'sim.svc.approval';
const entry = (over: Partial<BitmapCacheEntry> = {}): BitmapCacheEntry => ({
  key: KEY,
  prefix: PREFIX,
  prefixVersion: 'v3',
  mask: new Uint8Array([0x01, 0x02]),
  issuedAt: Date.now(),
  ttlMs: DEFAULT_BITMAP_TTL_MS,
  ...over,
});

describe('BitmapCacheEntry (spec 04 §3.1)', () => {
  it('default TTL=120_000ms (기본 120000 / 2분)', () => {
    expect(DEFAULT_BITMAP_TTL_MS).toBe(120_000);
  });
  it('setEntry/getEntry 라운드트립 — entry 본문 그대로', () => {
    const cache = new BitmapLruCache({ max: 100 });
    const e = entry();
    cache.setEntry(e);
    expect(cache.getEntry(KEY)).toEqual(e);
  });
  it('entry는 prefix/prefixVersion/issuedAt/ttlMs 모두 보유', () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.setEntry(entry());
    const got = cache.getEntry(KEY)!;
    expect(got.prefix).toBe(PREFIX);
    expect(got.prefixVersion).toBe('v3');
    expect(got.ttlMs).toBe(120_000);
  });
});

const makeSvc = (catVer: string, freshVer = catVer, freshMask = new Uint8Array([0xff])) => {
  const fetchBitmap = vi.fn(async () => ({
    prefix: PREFIX,
    prefixVersion: freshVer,
    mask: freshMask,
  }));
  const svc = new BitmapCacheService({
    publisherName: 'test',
    cache: { max: 100 },
    logger: silentLogger(),
    catalog: { getLatestPrefixVersion: vi.fn(async () => catVer) },
    authApi: { fetchBitmap },
  });
  return { svc, fetchBitmap };
};

describe('BitmapCacheService.getBitmap (spec 04 §3.2)', () => {
  it('(1) hit + valid TTL + version OK → 즉시 반환, auth-api 미호출', async () => {
    const { svc, fetchBitmap } = makeSvc('v3');
    svc.cache.setEntry(entry());
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0x01, 0x02]));
    expect(fetchBitmap).not.toHaveBeenCalled();
  });
  it('(2-a) miss → auth-api refresh + LRU set (ttlMs=120_000)', async () => {
    const { svc, fetchBitmap } = makeSvc('v3');
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xff]));
    expect(fetchBitmap).toHaveBeenCalledWith({ key: KEY, prefix: undefined });
    expect(svc.cache.getEntry(KEY)?.ttlMs).toBe(120_000);
  });
  it('(2-b) TTL 만료 → fallthrough', async () => {
    const { svc, fetchBitmap } = makeSvc('v3');
    svc.cache.setEntry(entry({ issuedAt: Date.now() - DEFAULT_BITMAP_TTL_MS - 1, ttlMs: 1 }));
    await svc.getBitmap(KEY);
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
  });
  it('(2-c) version mismatch → fallthrough, prefixVersion 갱신', async () => {
    const { svc, fetchBitmap } = makeSvc('v4', 'v4', new Uint8Array([0xee]));
    svc.cache.setEntry(entry({ prefixVersion: 'v3' }));
    expect(await svc.getBitmap(KEY)).toEqual(new Uint8Array([0xee]));
    expect(fetchBitmap).toHaveBeenCalledTimes(1);
    expect(svc.cache.getEntry(KEY)?.prefixVersion).toBe('v4');
  });
});

describe('BitmapCacheService — back-compat publisher/subscriber wiring', () => {
  it('publisher만 활성화 — subscriber undefined', () => {
    const redis = new RedisMock() as unknown as Redis;
    const svc = new BitmapCacheService({
      publisherRedis: redis,
      publisherName: 'p',
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeDefined();
    expect(svc.subscriber).toBeUndefined();
  });

  it('subscriber만 활성화 — publisher undefined', async () => {
    const redis = new RedisMock() as unknown as Redis;
    const svc = new BitmapCacheService({
      subscriberRedis: (redis as RedisMock).duplicate() as unknown as Redis,
      publisherName: 's',
      cache: { max: 100 },
      logger: silentLogger(),
    });
    expect(svc.publisher).toBeUndefined();
    expect(svc.subscriber).toBeDefined();
    await svc.start();
    await svc.stop();
  });

  it('둘 다 활성화 — publish → subscribe 통합 round-trip', async () => {
    const pubRedis = new RedisMock() as unknown as Redis;
    const subRedis = (pubRedis as RedisMock).duplicate() as unknown as Redis;
    const svc = new BitmapCacheService({
      publisherRedis: pubRedis,
      subscriberRedis: subRedis,
      publisherName: 'test',
      cache: { max: 100 },
      logger: silentLogger(),
    });
    svc.cache.set('u1', 'sim.bitmap', 'uv1', {
      prefix: 'sim.bitmap',
      v: 'uv1',
      mask: new Uint8Array([0x01]),
      issuedAt: '2026-04-22T00:00:00Z',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuer: 'x',
      signature: 's',
    });
    await svc.start();
    await svc.publisher!.publishUserChange('u1', 'permission_change');
    await new Promise((r) => setTimeout(r, 100));
    expect(svc.cache.get('u1', 'sim.bitmap', 'uv1')).toBeUndefined();
    await svc.stop();
  });
});
