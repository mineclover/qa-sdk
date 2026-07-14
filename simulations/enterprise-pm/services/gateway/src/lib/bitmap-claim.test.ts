// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from 'vitest';
import { bitmapToClaim, claimToBitmap } from './bitmap-claim.js';
import type { VersionedBitmap } from 'permission-engine';

const sample: VersionedBitmap = {
  prefix: 'sim.bitmap',
  v: 'uv1',
  mask: new Uint8Array([0xff, 0x01, 0x80, 0x00, 0x42]),
  issuedAt: '2026-04-22T00:00:00.000Z',
  expiresAt: '2026-04-22T00:05:00.000Z',
  issuer: 'sim-auth-api',
  signature: 'deadbeef',
};

describe('bitmap-claim — VersionedBitmap ↔ JWT claim 직렬화', () => {
  it('bitmapToClaim — mask는 base64로 직렬화', () => {
    const claim = bitmapToClaim(sample);
    expect(claim.bitmap_prefix).toBe('sim.bitmap');
    expect(claim.bitmap_v).toBe('uv1');
    expect(claim.bitmap_mask).toBe(Buffer.from(sample.mask).toString('base64'));
    expect(claim.bitmap_issuer).toBe('sim-auth-api');
    expect(claim.bitmap_signature).toBe('deadbeef');
  });

  it('claimToBitmap — base64 mask 복원 라운드트립', () => {
    const claim = bitmapToClaim(sample);
    const restored = claimToBitmap(claim, sample.issuedAt, sample.expiresAt);
    expect(restored.prefix).toBe(sample.prefix);
    expect(restored.v).toBe(sample.v);
    expect(Array.from(restored.mask)).toEqual(Array.from(sample.mask));
    expect(restored.issuer).toBe(sample.issuer);
    expect(restored.signature).toBe(sample.signature);
  });

  it('invalid base64 mask → throw', () => {
    const bad = { ...bitmapToClaim(sample), bitmap_mask: '###not-base64###' };
    expect(() => claimToBitmap(bad, sample.issuedAt, sample.expiresAt)).toThrow(/base64/);
  });

  it('필수 claim 누락 → throw', () => {
    const partial = { bitmap_prefix: 'sim.bitmap' } as Partial<ReturnType<typeof bitmapToClaim>>;
    expect(() => claimToBitmap(partial, sample.issuedAt, sample.expiresAt)).toThrow(/required/);
  });

  it('mask 길이 보존 (다양한 길이 round-trip)', () => {
    for (const len of [1, 8, 16, 64, 128]) {
      const mask = new Uint8Array(len).map((_, i) => i % 256);
      const bm: VersionedBitmap = { ...sample, mask };
      const restored = claimToBitmap(bitmapToClaim(bm), bm.issuedAt, bm.expiresAt);
      expect(restored.mask.length).toBe(len);
      expect(Array.from(restored.mask)).toEqual(Array.from(mask));
    }
  });
});
