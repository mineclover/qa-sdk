// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, expect, it } from 'vitest';

import {
  AddressContextV1Schema,
  parsePackedAddress,
  serializePackedAddress,
  type ParsedPackedAddress,
} from './address-context-schema.js';

describe('parsePackedAddress', () => {
  it('3-part: prefix:version:address', () => {
    expect(parsePackedAddress('svc:v1:42')).toEqual({
      prefix: 'svc',
      version: 'v1',
      address: 42,
    });
  });

  it('4-part: catalogId:prefix:version:address', () => {
    expect(parsePackedAddress('cat-1:svc:v1:42')).toEqual({
      catalogId: 'cat-1',
      prefix: 'svc',
      version: 'v1',
      address: 42,
    });
  });

  it('주소가 음수이거나 NaN인 경우 → null', () => {
    expect(parsePackedAddress('svc:v1:abc')).toBeNull();
    expect(parsePackedAddress('svc:v1:-1')).toBeNull();
  });

  it('part 수 부족 → null', () => {
    expect(parsePackedAddress('svc:v1')).toBeNull();
    expect(parsePackedAddress('')).toBeNull();
  });

  it('part 수 초과 (5+) → null', () => {
    expect(parsePackedAddress('a:b:c:d:e')).toBeNull();
  });
});

describe('serializePackedAddress', () => {
  it('3-part round-trip', () => {
    const parsed: ParsedPackedAddress = { prefix: 'svc', version: 'v1', address: 42 };
    const s = serializePackedAddress(parsed);
    expect(s).toBe('svc:v1:42');
    expect(parsePackedAddress(s)).toEqual(parsed);
  });

  it('4-part round-trip with catalogId', () => {
    const parsed: ParsedPackedAddress = {
      catalogId: 'cat-1',
      prefix: 'svc',
      version: 'v1',
      address: 42,
    };
    expect(serializePackedAddress(parsed)).toBe('cat-1:svc:v1:42');
  });
});

describe('AddressContextV1Schema', () => {
  it('유효한 컨텍스트 통과', () => {
    const ctx = { svc: 'svc:v1:1', pv: 'pv:v2:5' };
    expect(AddressContextV1Schema.parse(ctx)).toEqual(ctx);
  });

  it('빈 객체 허용 (매핑 없는 이벤트)', () => {
    expect(AddressContextV1Schema.parse({})).toEqual({});
  });

  it('값 형식 위반 → ZodError', () => {
    const bad = { svc: 'not-a-packed-key' };
    expect(() => AddressContextV1Schema.parse(bad)).toThrow();
  });

  it('값에 NaN address → ZodError', () => {
    const bad = { svc: 'svc:v1:abc' };
    expect(() => AddressContextV1Schema.parse(bad)).toThrow();
  });
});
