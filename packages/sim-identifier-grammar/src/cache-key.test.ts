import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildBitmapCacheKey, parseBitmapCacheKey, type BitmapCacheKey } from './cache-key.js';

const P = { namespace: 'sim', category: 'svc', name: 'approval' } as const;
const V = { axis: 'version', value: 3, state: 'stable' } as const;
const ok = (over: Partial<BitmapCacheKey> = {}): BitmapCacheKey => ({
  scope: 'user',
  id: 'U001',
  prefix: P,
  version: V,
  ...over,
});

describe('bitmap cache key grammar (#11)', () => {
  it('builds spec §2.11 canonical bitmap:user:U001:sim.svc.approval:v3', () => {
    expect(buildBitmapCacheKey(ok())).toBe('bitmap:user:U001:sim.svc.approval:v3');
  });
  it('parses canonical key back to original shape', () => {
    const orig = ok({ scope: 'role', id: 'ops-admin' });
    expect(parseBitmapCacheKey(buildBitmapCacheKey(orig))).toEqual(orig);
  });
  it('rejects invalid scope', () => {
    expect(() => buildBitmapCacheKey(ok({ scope: 'tenant' as never }))).toThrow();
  });
  it("rejects id with separator characters (':' / space)", () => {
    expect(() => buildBitmapCacheKey(ok({ id: 'U:001' }))).toThrow();
  });
  it('rejects invalid prefix (#1 reuse: ServicePrefixSchema 위반)', () => {
    expect(() =>
      buildBitmapCacheKey(
        ok({ prefix: { namespace: 'app' as never, category: 'svc', name: 'approval' } }),
      ),
    ).toThrow();
  });
  it('rejects invalid version (#2 reuse: state 외 값)', () => {
    expect(() =>
      buildBitmapCacheKey(ok({ version: { axis: 'version', value: 1, state: 'draft' as never } })),
    ).toThrow();
  });
  it('rejects parsing of legacy flat key (spec §2.11 잘못된 사용)', () => {
    expect(() => parseBitmapCacheKey('bitmap:user:U001:approval-v3')).toThrow();
  });
  it('roundtrip property (200 cases — scope × id × prefix × version)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('user', 'role'),
        fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom('stable', 'candidate', 'retired'),
        (scope, id, name, value, state) => {
          const orig: BitmapCacheKey = {
            scope: scope as 'user' | 'role',
            id,
            prefix: { namespace: 'sim', category: 'svc', name },
            version: { axis: 'version', value, state },
          };
          expect(parseBitmapCacheKey(buildBitmapCacheKey(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
