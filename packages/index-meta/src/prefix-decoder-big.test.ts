// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, it, expect } from 'vitest';
import { PrefixDecoderBig } from './prefix-decoder-big.js';
import type { PrefixDecoderBigConfig } from './prefix-decoder-big.js';
import { ValidationError } from './errors.js';
import type { DecodeMap } from './types.js';

// ── 픽스처 ──────────────────────────────────────────────────────────────────

/**
 * 3×3×3 perm index (BigInt). shape 곱 = 27이지만 numberType="bigint" 선언.
 * 실제로는 Number 범위에 들어가지만, BigInt 코드 경로를 테스트하기 위해 사용.
 */
const permMapBig = (): DecodeMap => ({
  indexId: 'perm',
  versionId: 'v1',
  shape: [3, 3, 3],
  size: 27,
  numberType: 'bigint',
  dims: [
    {
      dimId: 'role',
      snapshotId: 'sv1',
      kind: { type: 'string_enum' },
      entries: ['admin', 'editor', 'viewer'],
    },
    {
      dimId: 'action',
      snapshotId: 'sv1',
      kind: { type: 'string_enum' },
      entries: ['read', 'write', 'delete'],
    },
    { dimId: 'resource', snapshotId: 'sv1', kind: { type: 'number_enum' }, entries: [10, 20, 30] },
  ],
});

/**
 * 대형 BigInt 주소 공간: 각 dim capacity 가 크면 product가 2^53 초과.
 * 256 × 256 × 256 × 256 = 4,294,967,296 — Number 범위이지만 BigInt로 처리.
 */
const largeMapBig = (): DecodeMap => {
  const makeEntries = (n: number): string[] => Array.from({ length: n }, (_, i) => `e${i}`);

  return {
    indexId: 'large',
    versionId: 'v1',
    shape: [256, 256, 256],
    size: 16_777_216, // Number 캡. 실제 BigInt 곱 = 16,777,216
    numberType: 'bigint',
    dims: [
      { dimId: 'd0', snapshotId: 'sv1', kind: { type: 'string_enum' }, entries: makeEntries(256) },
      { dimId: 'd1', snapshotId: 'sv1', kind: { type: 'string_enum' }, entries: makeEntries(256) },
      { dimId: 'd2', snapshotId: 'sv1', kind: { type: 'string_enum' }, entries: makeEntries(256) },
    ],
  };
};

/**
 * cross-index 픽스처 (BigInt):
 * service = [env(2), region(3)] → 6 combinations
 * permission = [perm_svc(→service, 6), role(3)] → 18 combinations
 */
const crossIndexMapsBig = (): { permissionMap: DecodeMap; serviceMap: DecodeMap } => {
  const serviceMap: DecodeMap = {
    indexId: 'service',
    versionId: 'v1',
    shape: [2, 3],
    size: 6,
    numberType: 'bigint',
    dims: [
      {
        dimId: 'env',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['prod', 'staging'],
      },
      {
        dimId: 'region',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['asia', 'eu', 'us'],
      },
    ],
  };

  const permissionMap: DecodeMap = {
    indexId: 'permission',
    versionId: 'v1',
    shape: [6, 3],
    size: 18,
    numberType: 'bigint',
    dims: [
      {
        dimId: 'perm_svc',
        snapshotId: 'sv1',
        kind: { type: 'index_ref', indexId: 'service' },
        entries: [0, 1, 2, 3, 4, 5],
      },
      {
        dimId: 'role',
        snapshotId: 'sv1',
        kind: { type: 'string_enum' },
        entries: ['admin', 'editor', 'viewer'],
      },
    ],
  };

  return { permissionMap, serviceMap };
};

// ── 생성 ────────────────────────────────────────────────────────────────────

describe('PrefixDecoderBig 생성', () => {
  it('BigInt DecodeMap으로 생성할 수 있다', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    expect(decoder.indexId).toBe('perm');
    expect(decoder.versionId).toBe('v1');
    expect(decoder.size).toBe(27n);
    expect(decoder.shape).toEqual([3n, 3n, 3n]);
    expect(decoder.strides).toEqual([9n, 3n, 1n]);
    expect(decoder.dimIds).toEqual(['role', 'action', 'resource']);
  });

  it('refs 포함 생성', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(decoder.indexId).toBe('permission');
    expect(decoder.hasRef('perm_svc')).toBe(true);
    expect(decoder.hasRef('role')).toBe(false);
  });

  it("numberType이 'number'인 DecodeMap → ValidationError", () => {
    const map = { ...permMapBig(), numberType: 'number' as const };
    expect(() => new PrefixDecoderBig({ map })).toThrow(ValidationError);
  });

  it('numberType 미지정이면 허용 (호출자 판단 존중)', () => {
    const map = { ...permMapBig() };
    delete (map as Partial<DecodeMap>).numberType;
    expect(() => new PrefixDecoderBig({ map })).not.toThrow();
  });
});

// ── resolve ─────────────────────────────────────────────────────────────────

describe('resolve', () => {
  it('bigint → VersionedValueBig', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const vv = decoder.resolve(0n);
    expect(vv).toEqual({ indexId: 'perm', versionId: 'v1', value: 0n });
  });

  it('임의 bigint', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const vv = decoder.resolve(13n);
    expect(vv).toEqual({ indexId: 'perm', versionId: 'v1', value: 13n });
  });
});

// ── decode ──────────────────────────────────────────────────────────────────

describe('decode(bigint)', () => {
  it('bigint → entity record', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const result = decoder.decode(0n);
    expect(result).toEqual({ role: 'admin', action: 'read', resource: 10 });
  });

  it('마지막 주소 decode', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const result = decoder.decode(26n);
    expect(result).toEqual({ role: 'viewer', action: 'delete', resource: 30 });
  });

  it('중간 주소 decode', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    // value 13: shape [3,3,3], strides [9,3,1]
    // 13 / 9 = 1 r4, 4/3 = 1 r1 → coords [2,2,2] (1-based) → entries[1] each
    const result = decoder.decode(13n);
    expect(result).toEqual({ role: 'editor', action: 'write', resource: 20 });
  });
});

// ── decodeDeep ──────────────────────────────────────────────────────────────

describe('decodeDeep', () => {
  it('refs 있을 때 index_ref 1-level 확장', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 0: perm_svc=0 (service addr 0 → env=prod, region=asia), role=admin
    const result = decoder.decodeDeep(0n);
    expect(result.entities).toEqual({ perm_svc: 0, role: 'admin' });
    expect(result.refs).toEqual({
      perm_svc: { env: 'prod', region: 'asia' },
    });
  });

  it('다양한 값으로 deep decode', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 5: shape [6,3] → perm_svc=1 (service addr 1 → env=prod, region=eu), role=viewer
    const result = decoder.decodeDeep(5n);
    expect(result.entities).toEqual({ perm_svc: 1, role: 'viewer' });
    expect(result.refs).toEqual({
      perm_svc: { env: 'prod', region: 'eu' },
    });
  });

  it('refs 없을 때 raw number 유지', () => {
    const { permissionMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({ map: permissionMap });

    const result = decoder.decodeDeep(0n);
    expect(result.entities).toEqual({ perm_svc: 0, role: 'admin' });
    expect(result.refs).toEqual({});
  });

  it('index_ref 아닌 dim은 refs에 포함 안 됨', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const result = decoder.decodeDeep(0n);
    expect(result.refs).toEqual({});
  });
});

// ── decodeDeepDetailed ──────────────────────────────────────────────────────

describe('decodeDeepDetailed', () => {
  it('unresolved ref 수집', () => {
    const { permissionMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({ map: permissionMap });

    const result = decoder.decodeDeepDetailed(0n);
    expect(result.unresolved).toEqual(['perm_svc']);
  });

  it('모든 ref 있으면 unresolved 비어 있음', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    const result = decoder.decodeDeepDetailed(0n);
    expect(result.unresolved).toEqual([]);
  });
});

// ── decodeBatch ─────────────────────────────────────────────────────────────

describe('decodeBatch', () => {
  it('bigint 배열', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const results = decoder.decodeBatch([0n, 26n]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ role: 'admin', action: 'read', resource: 10 });
    expect(results[1]).toEqual({ role: 'viewer', action: 'delete', resource: 30 });
  });

  it('빈 배열', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    expect(decoder.decodeBatch([])).toEqual([]);
  });
});

// ── matchRanges ─────────────────────────────────────────────────────────────

describe('matchRanges', () => {
  it('부분 조건 매칭 (BigInt 범위 반환)', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const ranges = decoder.matchRanges({ role: 'admin' });
    expect(ranges).toEqual([[0n, 8n]]);
  });
});

// ── resolveRef / hasRef ─────────────────────────────────────────────────────

describe('resolveRef / hasRef', () => {
  it('ref 코덱으로 해석', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });

    // value 0n: perm_svc=0 → service decode(0) → { env: "prod", region: "asia" }
    const result = decoder.resolveRef(0n, 'perm_svc');
    expect(result).toEqual({ env: 'prod', region: 'asia' });
  });

  it('hasRef 확인', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(decoder.hasRef('perm_svc')).toBe(true);
    expect(decoder.hasRef('role')).toBe(false);
    expect(decoder.hasRef('nonexistent')).toBe(false);
  });

  it('존재하지 않는 dim → ValidationError', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(() => decoder.resolveRef(0n, 'nonexistent')).toThrow(ValidationError);
  });

  it('index_ref 아닌 dim → ValidationError', () => {
    const { permissionMap, serviceMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({
      map: permissionMap,
      refs: { service: serviceMap },
    });
    expect(() => decoder.resolveRef(0n, 'role')).toThrow(ValidationError);
  });

  it('ref 코덱 없을 때 → ValidationError', () => {
    const { permissionMap } = crossIndexMapsBig();
    const decoder = new PrefixDecoderBig({ map: permissionMap });
    expect(() => decoder.resolveRef(0n, 'perm_svc')).toThrow(ValidationError);
  });
});

// ── encode → decode 왕복 ────────────────────────────────────────────────────

describe('encode → decode 왕복', () => {
  it('encode → decode round-trip', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    const entities = { role: 'admin', action: 'write', resource: 20 };
    const vv = decoder.encode(entities);
    const decoded = decoder.decode(vv.value);
    expect(decoded).toEqual(entities);
  });

  it('모든 주소 왕복 확인', () => {
    const decoder = new PrefixDecoderBig({ map: permMapBig() });
    for (let i = 0n; i < decoder.size; i++) {
      const decoded = decoder.decode(i);
      const re = decoder.encode(decoded as Record<string, string | number>);
      expect(re.value).toBe(i);
    }
  });
});

// ── 대형 주소 공간 ──────────────────────────────────────────────────────────

describe('대형 BigInt 주소 공간', () => {
  it('256×256×256 decode 가능', () => {
    const decoder = new PrefixDecoderBig({ map: largeMapBig() });
    expect(decoder.size).toBe(16_777_216n);

    // 첫 번째 주소
    const first = decoder.decode(0n);
    expect(first).toEqual({ d0: 'e0', d1: 'e0', d2: 'e0' });

    // 마지막 주소
    const last = decoder.decode(16_777_215n);
    expect(last).toEqual({ d0: 'e255', d1: 'e255', d2: 'e255' });
  });

  it('대형 주소 공간에서 encode → decode round-trip', () => {
    const decoder = new PrefixDecoderBig({ map: largeMapBig() });
    const entities = { d0: 'e100', d1: 'e200', d2: 'e50' };
    const vv = decoder.encode(entities);
    const decoded = decoder.decode(vv.value);
    expect(decoded).toEqual(entities);
  });
});

// ── toDecodeMap ─────────────────────────────────────────────────────────────

describe('toDecodeMap', () => {
  it('원본 DecodeMap과 동일 구조 반환', () => {
    const original = permMapBig();
    const decoder = new PrefixDecoderBig({ map: original });
    const exported = decoder.toDecodeMap();
    expect(exported).toEqual(original);
  });
});
