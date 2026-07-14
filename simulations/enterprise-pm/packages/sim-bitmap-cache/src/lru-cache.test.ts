// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from 'vitest';
import { BitmapLruCache, makeKey, parseKey } from './lru-cache.js';
import type { VersionedBitmap } from 'permission-engine';

const sampleBm = (id: string): VersionedBitmap => ({
  prefix: 'sim.bitmap',
  v: 'uv1',
  mask: new Uint8Array([0x01, 0x02]),
  issuedAt: '2026-04-22T00:00:00Z',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  issuer: 'sim-auth-api',
  signature: id,
});

describe('BitmapLruCache', () => {
  it('set/get round-trip', () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set('user-1', 'sim.bitmap', 'uv1', sampleBm('a'));
    const got = cache.get('user-1', 'sim.bitmap', 'uv1');
    expect(got?.signature).toBe('a');
  });

  it('get(미존재) → undefined', () => {
    const cache = new BitmapLruCache({ max: 100 });
    expect(cache.get('nope', 'sim.bitmap', 'uv1')).toBeUndefined();
  });

  it('invalidateUser — 해당 user의 모든 (prefix, v) 삭제', () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set('user-1', 'sim.bitmap', 'uv1', sampleBm('a'));
    cache.set('user-1', 'sim.bitmap', 'uv2', sampleBm('b'));
    cache.set('user-2', 'sim.bitmap', 'uv1', sampleBm('c'));
    cache.invalidateUser('user-1');
    expect(cache.get('user-1', 'sim.bitmap', 'uv1')).toBeUndefined();
    expect(cache.get('user-1', 'sim.bitmap', 'uv2')).toBeUndefined();
    expect(cache.get('user-2', 'sim.bitmap', 'uv1')?.signature).toBe('c');
  });

  it('invalidateUsers — affectedUserIds 일괄 삭제', () => {
    const cache = new BitmapLruCache({ max: 100 });
    for (const id of ['a', 'b', 'c']) {
      cache.set(id, 'sim.bitmap', 'uv1', sampleBm(id));
    }
    cache.invalidateUsers(['a', 'c']);
    expect(cache.get('a', 'sim.bitmap', 'uv1')).toBeUndefined();
    expect(cache.get('b', 'sim.bitmap', 'uv1')?.signature).toBe('b');
    expect(cache.get('c', 'sim.bitmap', 'uv1')).toBeUndefined();
  });

  it('invalidatePrefix — 해당 prefix의 모든 entry 삭제', () => {
    const cache = new BitmapLruCache({ max: 100 });
    cache.set('u1', 'sim.bitmap', 'uv1', sampleBm('a'));
    cache.set('u2', 'sim.bitmap', 'uv1', sampleBm('b'));
    cache.set('u1', 'other.prefix', 'uv1', sampleBm('c'));
    cache.invalidatePrefix('sim.bitmap');
    expect(cache.get('u1', 'sim.bitmap', 'uv1')).toBeUndefined();
    expect(cache.get('u2', 'sim.bitmap', 'uv1')).toBeUndefined();
    expect(cache.get('u1', 'other.prefix', 'uv1')?.signature).toBe('c');
  });

  it('max 초과 시 LRU eviction', () => {
    const cache = new BitmapLruCache({ max: 2 });
    cache.set('u1', 'sim.bitmap', 'uv1', sampleBm('a'));
    cache.set('u2', 'sim.bitmap', 'uv1', sampleBm('b'));
    cache.set('u3', 'sim.bitmap', 'uv1', sampleBm('c'));
    expect(cache.get('u1', 'sim.bitmap', 'uv1')).toBeUndefined();
    expect(cache.get('u2', 'sim.bitmap', 'uv1')?.signature).toBe('b');
    expect(cache.get('u3', 'sim.bitmap', 'uv1')?.signature).toBe('c');
  });

  it('makeKey / parseKey round-trip', () => {
    const k = makeKey('user-1', 'sim.bitmap', 'uv1');
    expect(k).toBe('user-1|sim.bitmap|uv1');
    expect(parseKey(k)).toEqual({
      userId: 'user-1',
      prefix: 'sim.bitmap',
      v: 'uv1',
    });
  });
});
