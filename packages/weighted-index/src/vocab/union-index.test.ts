// @def.boundary weighted-index-system
// @def.doc wi-disjoint-union-addressing

import { describe, expect, it } from 'vitest';

import { DisjointUnionIndex, UnionKindError } from './union-index.js';
import { IndexRangeError, WeightedIndexError, CoordError, ShapeError } from '../math/errors.js';

describe('DisjointUnionIndex', () => {
  describe('construction', () => {
    it('여러 variants로 구성 + totalSize = ∑ sizes', () => {
      const u = new DisjointUnionIndex([
        { kind: 'resource', shape: [3, 3] }, // size 9
        { kind: 'transaction', shape: [2, 5] }, // size 10
      ]);
      expect(u.totalSize).toBe(19);
      expect(u.kinds).toEqual(['resource', 'transaction']);
    });

    it('단일 variant도 허용 — 퇴행 케이스', () => {
      const u = new DisjointUnionIndex([{ kind: 'only', shape: [4] }]);
      expect(u.totalSize).toBe(4);
    });

    it('빈 variants 거부', () => {
      expect(() => new DisjointUnionIndex([])).toThrow(WeightedIndexError);
    });

    it('중복 kind 거부', () => {
      expect(
        () =>
          new DisjointUnionIndex([
            { kind: 'a', shape: [2] },
            { kind: 'a', shape: [3] },
          ]),
      ).toThrow(WeightedIndexError);
    });

    it('잘못된 shape은 WeightedIndex가 거부', () => {
      expect(() => new DisjointUnionIndex([{ kind: 'a', shape: [0] }])).toThrow(ShapeError);
    });
  });

  describe('encode / decode', () => {
    const u = new DisjointUnionIndex([
      { kind: 'resource', shape: [3, 3] },
      { kind: 'transaction', shape: [2, 5] },
    ]);

    it('첫 variant: address = 0..8', () => {
      expect(u.encode('resource', [1, 1])).toBe(0);
      expect(u.encode('resource', [3, 3])).toBe(8);
    });

    it('두 번째 variant: address = 9..18 (offset 적용)', () => {
      expect(u.encode('transaction', [1, 1])).toBe(9);
      expect(u.encode('transaction', [2, 5])).toBe(18);
    });

    it('round-trip: 모든 address → decode → 같은 kind + coords', () => {
      for (let a = 0; a < u.totalSize; a++) {
        const { kind, coords } = u.decode(a);
        expect(u.encode(kind, coords)).toBe(a);
      }
    });

    it('경계 테스트 — 경계 address가 올바른 kind로 매핑', () => {
      expect(u.decode(0).kind).toBe('resource');
      expect(u.decode(8).kind).toBe('resource');
      expect(u.decode(9).kind).toBe('transaction');
      expect(u.decode(18).kind).toBe('transaction');
    });

    it('미등록 kind는 UnionKindError', () => {
      expect(() => u.encode('admin', [1])).toThrow(UnionKindError);
    });

    it('address 범위 초과는 IndexRangeError', () => {
      expect(() => u.decode(-1)).toThrow(IndexRangeError);
      expect(() => u.decode(19)).toThrow(IndexRangeError);
      expect(() => u.decode(100)).toThrow(IndexRangeError);
    });

    it('좌표 범위 초과는 WeightedIndex의 CoordError', () => {
      expect(() => u.encode('resource', [4, 1])).toThrow(CoordError);
    });
  });

  describe('rangeOf', () => {
    const u = new DisjointUnionIndex([
      { kind: 'a', shape: [3, 3] },
      { kind: 'b', shape: [2, 5] },
      { kind: 'c', shape: [1, 7] },
    ]);

    it('각 kind의 [lo, hi] 전역 범위', () => {
      expect(u.rangeOf('a')).toEqual([0, 8]);
      expect(u.rangeOf('b')).toEqual([9, 18]);
      expect(u.rangeOf('c')).toEqual([19, 25]);
    });

    it('미등록 kind는 UnionKindError', () => {
      expect(() => u.rangeOf('z')).toThrow(UnionKindError);
    });
  });

  describe('calcAddressRanges', () => {
    const u = new DisjointUnionIndex([
      { kind: 'resource', shape: [3, 3, 3] }, // [0, 26]
      { kind: 'transaction', shape: [2, 5] }, // [27, 36]
    ]);

    it('resource kind 내 role=2 슬라이스는 전역 [9, 17]', () => {
      const ranges = u.calcAddressRanges('resource', ['2', null, null]);
      expect(ranges).toEqual([[9, 17]]);
    });

    it('transaction kind 내 전체는 [27, 36]', () => {
      const ranges = u.calcAddressRanges('transaction', [null, null]);
      expect(ranges).toEqual([[27, 36]]);
    });

    it('transaction kind 내 첫 번째 축=1은 [27, 31]', () => {
      const ranges = u.calcAddressRanges('transaction', ['1', null]);
      expect(ranges).toEqual([[27, 31]]);
    });

    it('미등록 kind는 UnionKindError', () => {
      expect(() => u.calcAddressRanges('z', [null])).toThrow(UnionKindError);
    });
  });

  describe('createMask', () => {
    it('전체 union 크기에 맞는 Uint8Array', () => {
      const u = new DisjointUnionIndex([
        { kind: 'a', shape: [3, 3] },
        { kind: 'b', shape: [2, 5] },
      ]);
      const mask = u.createMask();
      expect(mask).toBeInstanceOf(Uint8Array);
      expect(mask.length).toBe(Math.ceil(19 / 8)); // 3 bytes
    });
  });

  describe('getIndex', () => {
    it('kind별 WeightedIndex 인스턴스 접근', () => {
      const u = new DisjointUnionIndex([{ kind: 'a', shape: [3, 3], labels: ['x', 'y'] }]);
      const wi = u.getIndex('a');
      expect(wi.size).toBe(9);
      expect(wi.labels).toEqual(['x', 'y']);
    });

    it('미등록 kind는 UnionKindError', () => {
      const u = new DisjointUnionIndex([{ kind: 'a', shape: [2] }]);
      expect(() => u.getIndex('z')).toThrow(UnionKindError);
    });
  });

  describe('append-only 불변 (기존 variant의 range는 새 variant 추가 후에도 동일)', () => {
    it('기존 kind의 rangeOf는 variant 추가 여부와 무관하게 동일', () => {
      const u1 = new DisjointUnionIndex([{ kind: 'a', shape: [3, 3] }]);
      const u2 = new DisjointUnionIndex([
        { kind: 'a', shape: [3, 3] },
        { kind: 'b', shape: [2] }, // 추가
      ]);
      expect(u1.rangeOf('a')).toEqual(u2.rangeOf('a'));
    });
  });

  describe('정합성 — kind별 address는 서로 disjoint', () => {
    it('한 kind의 address set과 다른 kind의 address set은 교집합 없음', () => {
      const u = new DisjointUnionIndex([
        { kind: 'r', shape: [5, 5] },
        { kind: 't', shape: [3, 3] },
      ]);
      const rSet = new Set<number>();
      for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) rSet.add(u.encode('r', [i, j]));
      const tSet = new Set<number>();
      for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) tSet.add(u.encode('t', [i, j]));
      for (const a of rSet) expect(tSet.has(a)).toBe(false);
      expect(rSet.size + tSet.size).toBe(u.totalSize);
    });
  });
});
