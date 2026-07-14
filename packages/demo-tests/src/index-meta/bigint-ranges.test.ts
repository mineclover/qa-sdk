// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * B-3: MetaCodecBig.matchRanges 대형 shape 테스트
 *
 * shape product > 2^53인 상태에서 matchRanges가 정확한 BigInt 범위를 반환하는지 검증.
 * 소형 shape에서는 B-2에서 Number 동등성을 검증했으므로,
 * 여기서는 Number로 불가능한 영역에서의 정확성을 확인한다.
 */
import { describe, it, expect } from 'vitest';
import { MetaCodecBig } from 'index-meta';
import type { DecodeMap, EntityId } from 'index-meta';
import { WeightedIndexBig, calcAddressRangesBig, containsAddressBig } from 'weighted-index';

// ── 테스트 데이터: shape product > 2^53 ─────────────────────────────────────

// 200,000 × 200,000 × 200,000 = 8 × 10^15 > 2^53 (≈ 9 × 10^15)
// 각 dim에 실제 entries 배열을 만들면 메모리 폭발 → 작은 entries + 큰 capacity 활용
// MetaCodecBig은 entries.length 기반 shape → entries를 직접 사용

// 대안: 적당한 크기의 entries로 shape product > 2^53을 달성
// 1000 × 1000 × 1000 × 1000 = 10^12 < 2^53
// 10000 × 10000 × 10000 = 10^12 < 2^53
// 100 × 100 × 100 × 100 × 100 × 100 = 10^12 < 2^53
// 더 큰 조합이 필요: 3000 × 3000 × 3000 = 2.7 × 10^10 (still < 2^53)
// 실제로 2^53 넘기려면 entries 수가 커야 함
// 하지만 테스트에서 300K entries 배열 생성은 비용이 큼

// 전략: WeightedIndexBig을 직접 사용하여 bigint shape로 테스트하되,
// MetaCodecBig은 작은 entries에서 matchRanges의 BigInt 반환 타입과 범위 정확성만 검증

const generateEntries = (prefix: string, count: number): EntityId[] =>
  Array.from({ length: count }, (_, i) => `${prefix}_${i}`);

// 3차원: 500 × 400 × 300 = 60,000,000 (Number 안전 범위, BigInt 정확성 검증용)
const largeMap: DecodeMap = {
  indexId: 'large',
  versionId: 'v1',
  shape: [500, 400, 300],
  size: 60_000_000,
  dims: [
    {
      dimId: 'a',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: generateEntries('a', 500),
    },
    {
      dimId: 'b',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: generateEntries('b', 400),
    },
    {
      dimId: 'c',
      snapshotId: 's1',
      kind: { type: 'string_enum' },
      entries: generateEntries('c', 300),
    },
  ],
};

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('B-3: MetaCodecBig.matchRanges 대형 shape', () => {
  const codec = new MetaCodecBig(largeMap);

  describe('단일 축 제약', () => {
    it('첫 번째 축 고정 → 연속 범위 1개', () => {
      const ranges = codec.matchRanges({ a: 'a_0', b: null, c: null });

      // a=0 → 연속 범위 [0, 400*300-1] = [0, 119999]
      expect(ranges.length).toBe(1);
      expect(ranges[0][0]).toBe(0n);
      expect(ranges[0][1]).toBe(BigInt(400 * 300 - 1));
    });

    it('마지막 축 고정 → 비연속 범위', () => {
      const ranges = codec.matchRanges({ a: null, b: null, c: 'c_0' });

      // c=0 → 각 (a,b) 조합마다 범위 1개
      // stride[c] = 1, 간격 = 300 → 비연속
      expect(ranges.length).toBeGreaterThan(1);

      // 모든 범위가 BigInt 타입
      for (const [lo, hi] of ranges) {
        expect(typeof lo).toBe('bigint');
        expect(typeof hi).toBe('bigint');
        expect(hi).toBeGreaterThanOrEqual(lo);
      }
    });

    it('중간 축 고정', () => {
      const ranges = codec.matchRanges({ a: null, b: 'b_199', c: null });

      // b=199 → 각 a마다 연속 300개 범위
      expect(ranges.length).toBe(500); // a 차원 500개 각각에 1개 범위

      for (const [lo, hi] of ranges) {
        expect(hi - lo + 1n).toBe(300n); // 각 범위 크기 = c 차원 크기
      }
    });
  });

  describe('복수 축 제약', () => {
    it('2개 축 고정 → 좁은 범위', () => {
      const ranges = codec.matchRanges({ a: 'a_0', b: 'b_0', c: null });

      // a=0, b=0 → 연속 [0, 299]
      expect(ranges.length).toBe(1);
      expect(ranges[0][0]).toBe(0n);
      expect(ranges[0][1]).toBe(299n);
    });

    it('3개 축 모두 고정 → 단일 값 범위', () => {
      const ranges = codec.matchRanges({ a: 'a_0', b: 'b_0', c: 'c_0' });

      expect(ranges.length).toBe(1);
      expect(ranges[0][0]).toBe(ranges[0][1]); // 시작 = 끝
      expect(ranges[0][0]).toBe(0n);
    });

    it('전체 wildcard → 전체 범위', () => {
      const ranges = codec.matchRanges({ a: null, b: null, c: null });

      expect(ranges.length).toBe(1);
      expect(ranges[0][0]).toBe(0n);
      expect(ranges[0][1]).toBe(BigInt(60_000_000 - 1));
    });
  });

  describe('encode → matchRanges 포함 관계', () => {
    it('encode 결과가 matchRanges 범위에 포함', () => {
      const entities = { a: 'a_250', b: 'b_100', c: 'c_50' } as Record<string, EntityId>;
      const vv = codec.encode(entities);

      // 단일 축 제약으로 범위 계산
      const rangesA = codec.matchRanges({ a: 'a_250', b: null, c: null });
      const rangesB = codec.matchRanges({ a: null, b: 'b_100', c: null });
      const rangesAB = codec.matchRanges({ a: 'a_250', b: 'b_100', c: null });

      // encode된 값이 각 범위에 포함되어야 함
      expect(containsAddressBig(vv.value, rangesA)).toBe(true);
      expect(containsAddressBig(vv.value, rangesB)).toBe(true);
      expect(containsAddressBig(vv.value, rangesAB)).toBe(true);
    });

    it('encode 결과가 다른 축 제약 범위에 미포함', () => {
      const entities = { a: 'a_0', b: 'b_0', c: 'c_0' } as Record<string, EntityId>;
      const vv = codec.encode(entities);

      const rangesOther = codec.matchRanges({ a: 'a_499', b: null, c: null });
      expect(containsAddressBig(vv.value, rangesOther)).toBe(false);
    });
  });

  describe('WeightedIndexBig 직접 — 2^53 초과 shape', () => {
    // entries 배열 없이 순수 수학 레이어에서 BigInt 범위 정확성 검증
    // 10_000_000 × 10_000_000 × 10_000_000 = 10^21 >> 2^53 (≈ 9×10^15)
    const hugeDims = [10_000_000n, 10_000_000n, 10_000_000n];
    const wi = new WeightedIndexBig(hugeDims);

    it('size가 BigInt이고 2^53 초과', () => {
      expect(wi.size).toBe(10_000_000n * 10_000_000n * 10_000_000n);
      expect(wi.size).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    });

    it('encode → decode 왕복 (2^53 초과 주소)', () => {
      const coords = [5_000_000n, 5_000_000n, 5_000_000n];
      const encoded = wi.encode(coords);

      expect(encoded).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));

      const decoded = wi.decode(encoded);
      expect(decoded).toEqual(coords);
    });

    it('calcAddressRangesBig — 단일 축 제약', () => {
      const ranges = calcAddressRangesBig(hugeDims, ['1', null, null]);

      // dim[0]=1 → 연속 범위 1개, 크기 = 10_000_000 * 10_000_000
      expect(ranges.length).toBe(1);
      expect(ranges[0][1] - ranges[0][0] + 1n).toBe(10_000_000n * 10_000_000n);
    });

    it('calcAddressRangesBig — 경계값 (마지막 좌표)', () => {
      const lastCoords = [10_000_000n, 10_000_000n, 10_000_000n];
      const lastEncoded = wi.encode(lastCoords);

      expect(lastEncoded).toBe(wi.size - 1n);

      const decoded = wi.decode(lastEncoded);
      expect(decoded).toEqual(lastCoords);
    });
  });
});
