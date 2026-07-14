// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * B-2: INV-9 MetaCodec ↔ MetaCodecBig 동등성 테스트
 *
 * shape product ≤ 2^53인 범위에서 Number 경로와 BigInt 경로의 결과가 동일한지 검증.
 * WeightedIndex 동등성은 weighted-index-big.test.ts에서 검증됨.
 * 여기서는 MetaCodec 레이어의 동등성을 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { MetaCodec, MetaCodecBig } from 'index-meta';
import type { DecodeMap, EntityId } from 'index-meta';

// ── 테스트 데이터 ──────────────────────────────────────────────────────────────

const smallMap: DecodeMap = {
  indexId: 'perm',
  versionId: 'v1',
  shape: [3, 4, 2],
  size: 24,
  dims: [
    {
      dimId: 'role',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['admin', 'editor', 'viewer'],
    },
    {
      dimId: 'action',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['create', 'read', 'update', 'delete'],
    },
    {
      dimId: 'scope',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['own', 'all'],
    },
  ],
};

const mediumMap: DecodeMap = {
  indexId: 'event',
  versionId: 'v1',
  shape: [5, 8, 10, 3],
  size: 1200,
  dims: [
    {
      dimId: 'service',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['auth', 'billing', 'notify', 'store', 'analytics'],
    },
    {
      dimId: 'category',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['click', 'view', 'submit', 'error', 'load', 'unload', 'focus', 'blur'],
    },
    {
      dimId: 'page',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: [
        'home',
        'list',
        'detail',
        'cart',
        'checkout',
        'confirm',
        'profile',
        'settings',
        'help',
        'about',
      ],
    },
    {
      dimId: 'device',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: ['mobile', 'tablet', 'desktop'],
    },
  ],
};

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('B-2: INV-9 MetaCodec ↔ MetaCodecBig 동등성', () => {
  describe('소형 shape (3×4×2 = 24)', () => {
    const numCodec = new MetaCodec(smallMap);
    const bigCodec = new MetaCodecBig(smallMap);

    it('encode 결과 동등 — 모든 entity 조합', () => {
      for (const role of smallMap.dims[0].entries) {
        for (const action of smallMap.dims[1].entries) {
          for (const scope of smallMap.dims[2].entries) {
            const entities = { role, action, scope } as Record<string, EntityId>;

            const numResult = numCodec.encode(entities);
            const bigResult = bigCodec.encode(entities);

            expect(bigResult.value).toBe(BigInt(numResult.value));
            expect(bigResult.indexId).toBe(numResult.indexId);
            expect(bigResult.versionId).toBe(numResult.versionId);
          }
        }
      }
    });

    it('decode 결과 동등 — 모든 value', () => {
      for (let v = 0; v < smallMap.size; v++) {
        const numResult = numCodec.decodeValue(v);
        const bigResult = bigCodec.decodeValue(BigInt(v));

        expect(bigResult).toEqual(numResult);
      }
    });

    it('encode → decode 왕복 동등', () => {
      const entities = { role: 'editor', action: 'update', scope: 'own' } as Record<
        string,
        EntityId
      >;

      const numVV = numCodec.encode(entities);
      const bigVV = bigCodec.encode(entities);

      const numDecoded = numCodec.decodeValue(numVV.value);
      const bigDecoded = bigCodec.decodeValue(bigVV.value);

      expect(bigDecoded).toEqual(numDecoded);
      expect(bigDecoded).toEqual(entities);
    });
  });

  describe('중형 shape (5×8×10×3 = 1200)', () => {
    const numCodec = new MetaCodec(mediumMap);
    const bigCodec = new MetaCodecBig(mediumMap);

    it('encode 결과 동등 — 샘플 100건', () => {
      const dims = mediumMap.dims;

      for (let i = 0; i < 100; i++) {
        const entities: Record<string, EntityId> = {};
        for (const dim of dims) {
          entities[dim.dimId] = dim.entries[i % dim.entries.length];
        }

        const numResult = numCodec.encode(entities);
        const bigResult = bigCodec.encode(entities);

        expect(bigResult.value).toBe(BigInt(numResult.value));
      }
    });

    it('decode 결과 동등 — 샘플 100건', () => {
      for (let v = 0; v < 100; v++) {
        const numResult = numCodec.decodeValue(v);
        const bigResult = bigCodec.decodeValue(BigInt(v));

        expect(bigResult).toEqual(numResult);
      }
    });

    it('matchRanges 결과 동등', () => {
      const partial = { service: 'auth', category: null, page: null, device: null } as Record<
        string,
        EntityId | null
      >;

      const numRanges = numCodec.matchRanges(partial);
      const bigRanges = bigCodec.matchRanges(partial);

      expect(bigRanges.length).toBe(numRanges.length);
      for (let i = 0; i < numRanges.length; i++) {
        expect(bigRanges[i][0]).toBe(BigInt(numRanges[i][0]));
        expect(bigRanges[i][1]).toBe(BigInt(numRanges[i][1]));
      }
    });

    it('matchRanges 복수 축 제약 동등', () => {
      const partial = {
        service: 'billing',
        category: 'error',
        page: null,
        device: 'mobile',
      } as Record<string, EntityId | null>;

      const numRanges = numCodec.matchRanges(partial);
      const bigRanges = bigCodec.matchRanges(partial);

      expect(bigRanges.length).toBe(numRanges.length);
      for (let i = 0; i < numRanges.length; i++) {
        expect(bigRanges[i][0]).toBe(BigInt(numRanges[i][0]));
        expect(bigRanges[i][1]).toBe(BigInt(numRanges[i][1]));
      }
    });
  });

  describe('size/shape 속성 동등', () => {
    it('소형 — size 동등', () => {
      const numCodec = new MetaCodec(smallMap);
      const bigCodec = new MetaCodecBig(smallMap);

      expect(bigCodec.size).toBe(BigInt(numCodec.size));
    });

    it('중형 — shape 동등', () => {
      const numCodec = new MetaCodec(mediumMap);
      const bigCodec = new MetaCodecBig(mediumMap);

      expect(bigCodec.shape.length).toBe(numCodec.shape.length);
      for (let i = 0; i < numCodec.shape.length; i++) {
        expect(bigCodec.shape[i]).toBe(BigInt(numCodec.shape[i]));
      }
    });
  });
});
