import { describe, expect, it } from 'vitest';
import { decode, decodeDetailed, encode, encodeDetailed, type BrowserCatalog } from './index.js';

const CATALOG: BrowserCatalog = {
  svc: {
    version: 'v2',
    labels: ['env', 'ref'],
    dims: {
      env: { kind: 'axis', entries: ['dev', 'prod'], capacity: 4 },
      ref: { kind: 'prefix_ref', values: [0, 7] },
    },
  },
  unbound: { version: 'v1', labels: ['ref'], dims: { ref: { kind: 'prefix_ref', values: [] } } },
};

describe('encodeDetailed — 실패 원인 코드', () => {
  it.each([
    ['알 수 없는 prefix', 'nope', { env: 'dev', ref: 0 }, 'UnknownPrefix'],
    ['알 수 없는 entry', 'svc', { env: 'qa', ref: 0 }, 'InvalidDimensionValue'],
    ['알 수 없는 ref 값', 'svc', { env: 'dev', ref: 3 }, 'InvalidDimensionValue'],
    ['ref 값 누락', 'svc', { env: 'dev' }, 'InvalidDimensionValue'],
    ['refEntries 없는 prefix_ref', 'unbound', { ref: 0 }, 'InvalidDimensionValue'],
  ] as const)('%s → %s', (_name, prefix, values, code) => {
    const result = encodeDetailed(CATALOG, prefix, values);
    expect(result).toMatchObject({ ok: false, code });
    expect(encode(CATALOG, prefix, values)).toBeNull();
  });

  it('성공하면 encode와 같은 값을 담는다', () => {
    const result = encodeDetailed(CATALOG, 'svc', { env: 'prod', ref: 7 });
    expect(result).toEqual({ ok: true, value: encode(CATALOG, 'svc', { env: 'prod', ref: 7 }) });
  });
});

describe('decodeDetailed — 실패 원인 코드', () => {
  it.each([
    ['형식이 아닌 문자열', 'garbage', 'MalformedAddress'],
    ['선행 0', 'svc:v2:007', 'MalformedAddress'],
    ['소수', 'svc:v2:1.5', 'MalformedAddress'],
    ['빈 prefix', ':v2:1', 'MalformedAddress'],
    ['알 수 없는 prefix', 'nope:v1:0', 'UnknownPrefix'],
    ['browser catalog에 없는 version', 'svc:v1:0', 'UnknownPrefix'],
    ['범위 밖 주소', 'svc:v2:8', 'AddressOutOfRange'],
  ] as const)('%s → %s', (_name, serialized, code) => {
    expect(decodeDetailed(CATALOG, serialized)).toMatchObject({ ok: false, code });
    expect(decode(CATALOG, serialized)).toBeNull();
  });

  it('headroom position은 (reserved:N)으로 decode한다', () => {
    // env position 3 (capacity 4, entries 2) × ref stride 2 → 3*2 + 1 = 7
    expect(decodeDetailed(CATALOG, 'svc:v2:7')).toEqual({
      ok: true,
      value: { prefix: 'svc', version: 'v2', values: { env: '(reserved:3)', ref: 7 } },
    });
  });
});
