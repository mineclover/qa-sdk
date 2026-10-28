import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { computeCatalogDigest, digestCanonical, sha256Hex, shortDigest } from './digest.js';

describe('digest', () => {
  it('SHA-256 표준 벡터와 일치한다', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('digestCanonical은 sha256: 접두사와 64 hex를 쓴다', async () => {
    expect(await digestCanonical({})).toBe(
      'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });

  it('key 순서가 달라도 같은 digest', async () => {
    const a: Catalog = { id: 'c', name: 'n', axes: {}, prefixes: {} };
    const b = { prefixes: {}, axes: {}, name: 'n', id: 'c' } as Catalog;
    expect(await computeCatalogDigest(a)).toBe(await computeCatalogDigest(b));
  });

  it('내용이 다르면 digest가 다르다', async () => {
    const a: Catalog = { id: 'c', name: 'n', axes: {}, prefixes: {} };
    const b: Catalog = { ...a, name: 'n2' };
    expect(await computeCatalogDigest(a)).not.toBe(await computeCatalogDigest(b));
  });

  it('shortDigest는 표시용 12 hex만 돌려준다', () => {
    expect(shortDigest(`sha256:${'ab'.repeat(32)}`)).toBe('abababababab');
  });

  it('형식이 다른 digest는 shortDigest에서 거부한다', () => {
    expect(() => shortDigest('abc')).toThrow(TypeError);
  });
});
