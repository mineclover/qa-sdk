// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from 'vitest';
import { parseSerializedAddress, serializeAddress } from './address-parser.js';

describe('parseSerializedAddress', () => {
  it('3파트: prefix:version:address', () => {
    const r = parseSerializedAddress('permission:v1:42');
    expect(r).toEqual({ prefix: 'permission', version: 'v1', address: 42 });
    expect(r.catalogId).toBeUndefined();
  });

  it('4파트: catalogId:prefix:version:address', () => {
    const r = parseSerializedAddress('demo:permission:v1:42');
    expect(r).toEqual({ catalogId: 'demo', prefix: 'permission', version: 'v1', address: 42 });
  });

  it('4파트 + knownCatalogIds 검증 통과', () => {
    const known = new Set(['demo', 'custom']);
    const r = parseSerializedAddress('custom:order:v2:100', known);
    expect(r.catalogId).toBe('custom');
  });

  it('4파트 + knownCatalogIds에 없는 catalogId → 에러', () => {
    const known = new Set(['demo']);
    expect(() => parseSerializedAddress('unknown:order:v2:100', known)).toThrow(
      "Unknown catalog 'unknown'",
    );
  });

  it('4파트 + knownCatalogIds 미제공 → 첫 파트를 catalogId로 간주', () => {
    const r = parseSerializedAddress('any:perm:v1:0');
    expect(r.catalogId).toBe('any');
    expect(r.prefix).toBe('perm');
  });

  it('주소가 0인 경우', () => {
    const r = parseSerializedAddress('perm:v1:0');
    expect(r.address).toBe(0);
  });

  it('큰 주소 값', () => {
    const r = parseSerializedAddress('perm:v1:65536');
    expect(r.address).toBe(65536);
  });

  it('2파트 → 에러', () => {
    expect(() => parseSerializedAddress('perm:v1')).toThrow('Invalid address format');
  });

  it('5파트 → 에러', () => {
    expect(() => parseSerializedAddress('a:b:c:d:e')).toThrow('Invalid address format');
  });

  it('빈 문자열 → 에러', () => {
    expect(() => parseSerializedAddress('')).toThrow('Invalid address format');
  });

  it('숫자가 아닌 주소 (3파트) → 에러', () => {
    expect(() => parseSerializedAddress('perm:v1:abc')).toThrow('Invalid address number');
  });

  it('숫자가 아닌 주소 (4파트) → 에러', () => {
    expect(() => parseSerializedAddress('demo:perm:v1:abc')).toThrow('Invalid address number');
  });
});

describe('serializeAddress', () => {
  it('catalogId 없으면 3파트', () => {
    expect(serializeAddress({ prefix: 'perm', version: 'v1', address: 42 })).toBe('perm:v1:42');
  });

  it('catalogId 있으면 4파트', () => {
    expect(
      serializeAddress({ catalogId: 'demo', prefix: 'perm', version: 'v1', address: 42 }),
    ).toBe('demo:perm:v1:42');
  });

  it('라운드트립: 3파트', () => {
    const original = 'permission:v1:65536';
    const parsed = parseSerializedAddress(original);
    expect(serializeAddress(parsed)).toBe(original);
  });

  it('라운드트립: 4파트', () => {
    const original = 'demo:permission:v1:65536';
    const parsed = parseSerializedAddress(original);
    expect(serializeAddress(parsed)).toBe(original);
  });
});

describe('parseSerializedAddress strict 형식', () => {
  it.each([
    'service:v1:',
    'service:v1:1.5',
    'service:v1:0x1f',
    'service:v1:1e3',
    'service:v1:-1',
    'service:v1: 3',
    'service:v1:007',
    'service:v1:Infinity',
    'service:v1:9007199254740993',
    ':v1:3',
    'service::3',
    ':service:v1:3',
  ])('%s 는 거부한다', (input) => {
    expect(() => parseSerializedAddress(input)).toThrow();
  });

  it('0과 안전한 정수 최대값은 허용한다', () => {
    expect(parseSerializedAddress('service:v1:0').address).toBe(0);
    expect(parseSerializedAddress(`service:v1:${Number.MAX_SAFE_INTEGER}`).address).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});
