// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * WeightedIndexBig + calc-big 테스트
 *
 * BigInt 기반 encode/decode가 Number 기반과 동일한 결과를 내는지,
 * 그리고 2^53 초과 shape product를 처리할 수 있는지 검증한다.
 */

import { describe, it, expect } from 'vitest';
import { WeightedIndex } from './weighted-index.js';
import { WeightedIndexBig } from './weighted-index-big.js';
import { calcWeightsBig, calcAddressRangesBig, containsAddressBig } from './calc-big.js';
import { calcWeights, calcAddressRanges, containsAddress } from './calc.js';
import { ShapeError, CoordError, IndexRangeError } from './errors.js';

// ── WeightedIndexBig 기본 동작 ──────────────────────────────────────────────

describe('WeightedIndexBig — 기본 동작', () => {
  it('encode/decode가 양방향 전단사이다', () => {
    const wi = new WeightedIndexBig([8n, 4n, 16n, 4n]);
    const coords: bigint[] = [2n, 3n, 5n, 1n];
    const index = wi.encode(coords);
    const decoded = wi.decode(index);
    expect(decoded).toEqual(coords);
  });

  it('size가 shape product와 일치한다', () => {
    const wi = new WeightedIndexBig([8n, 4n, 16n, 4n]);
    expect(wi.size).toBe(8n * 4n * 16n * 4n);
  });

  it('strides가 올바르게 계산된다', () => {
    const wi = new WeightedIndexBig([8n, 4n, 16n, 4n]);
    expect(wi.strides).toEqual([256n, 64n, 4n, 1n]);
  });

  it('labels 기본값이 dim_0, dim_1 ... 형태이다', () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    expect(wi.labels).toEqual(['dim_0', 'dim_1']);
  });

  it('labels를 지정할 수 있다', () => {
    const wi = new WeightedIndexBig([3n, 4n], ['role', 'action']);
    expect(wi.labels).toEqual(['role', 'action']);
  });
});

// ── Number 기반과 결과 일치 ─────────────────────────────────────────────────

describe('WeightedIndexBig — Number 기반과 일치', () => {
  const shapes = [
    [8, 4, 16, 4],
    [3, 3, 3],
    [10, 7, 2],
    [100, 50],
  ];

  for (const shape of shapes) {
    it(`shape=[${shape}]에서 모든 주소가 일치한다`, () => {
      const wiNum = new WeightedIndex(shape);
      const wiBig = new WeightedIndexBig(shape.map(BigInt));

      // 랜덤 좌표 10개 검증
      for (let trial = 0; trial < 10; trial++) {
        const coordsNum = shape.map((s) => Math.floor(Math.random() * s) + 1);
        const coordsBig = coordsNum.map(BigInt);

        const numIndex = wiNum.encode(coordsNum);
        const bigIndex = wiBig.encode(coordsBig);
        expect(bigIndex).toBe(BigInt(numIndex));

        const numDecoded = wiNum.decode(numIndex);
        const bigDecoded = wiBig.decode(bigIndex);
        expect(bigDecoded).toEqual(numDecoded.map(BigInt));
      }
    });
  }
});

// ── 2^53 초과 shape product ─────────────────────────────────────────────────

describe('WeightedIndexBig — 2^53 초과 shape product', () => {
  it('Number.MAX_SAFE_INTEGER를 초과하는 shape product를 처리한다', () => {
    // 16^14 = 72,057,594,037,927,936 > Number.MAX_SAFE_INTEGER
    const shape = [16n, 16n, 16n, 16n, 16n, 16n, 16n, 2n]; // product = 2^29 = 536M... actually let me use bigger
    const bigShape = [1000n, 1000n, 1000n, 1000n, 1000n, 1000n]; // 10^18
    const wi = new WeightedIndexBig(bigShape);
    expect(wi.size).toBe(1000000000000000000n); // 10^18

    // 마지막 좌표
    const maxCoords = bigShape.map((s) => s);
    const maxIndex = wi.encode(maxCoords);
    expect(maxIndex).toBe(wi.size - 1n);

    // 복원 검증
    const decoded = wi.decode(maxIndex);
    expect(decoded).toEqual(maxCoords);
  });

  it('Number 기반은 2^53 초과에서 ShapeError를 던진다', () => {
    expect(() => new WeightedIndex([1000, 1000, 1000, 1000, 1000, 1000])).toThrow(ShapeError);
  });
});

// ── 경계 검사 ───────────────────────────────────────────────────────────────

describe('WeightedIndexBig — 경계 검사', () => {
  it('빈 shape에 대해 ShapeError', () => {
    expect(() => new WeightedIndexBig([])).toThrow(ShapeError);
  });

  it('0 이하 shape에 대해 ShapeError', () => {
    expect(() => new WeightedIndexBig([3n, 0n])).toThrow(ShapeError);
  });

  it('범위 밖 coords에 대해 CoordError', () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    expect(() => wi.encode([0n, 1n])).toThrow(CoordError);
    expect(() => wi.encode([4n, 1n])).toThrow(CoordError);
  });

  it('범위 밖 index에 대해 IndexRangeError', () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    expect(() => wi.decode(-1n)).toThrow(IndexRangeError);
    expect(() => wi.decode(wi.size)).toThrow(IndexRangeError);
  });

  it('encodeUnsafe/decodeUnsafe는 검사 없이 동작한다', () => {
    const wi = new WeightedIndexBig([8n, 4n]);
    const index = wi.encodeUnsafe([3n, 2n]);
    const coords = wi.decodeUnsafe(index);
    expect(coords).toEqual([3n, 2n]);
  });
});

// ── calcWeightsBig ──────────────────────────────────────────────────────────

describe('calcWeightsBig', () => {
  it('Number 기반 calcWeights와 일치한다', () => {
    const shape = [8, 4, 16, 4];
    const numWeights = calcWeights(shape);
    const bigWeights = calcWeightsBig(shape.map(BigInt));
    expect(bigWeights).toEqual(numWeights.map(BigInt));
  });
});

// ── calcAddressRangesBig ────────────────────────────────────────────────────

describe('calcAddressRangesBig', () => {
  it('Number 기반 calcAddressRanges와 일치한다', () => {
    const shapeNum = [8, 4, 16, 4];
    const shapeBig = shapeNum.map(BigInt);

    const constraints = ['1', null, null, null] as const;
    const numRanges = calcAddressRanges(shapeNum, constraints);
    const bigRanges = calcAddressRangesBig(shapeBig, constraints);

    expect(bigRanges).toEqual(numRanges.map(([f, t]) => [BigInt(f), BigInt(t)]));
  });

  it('복합 constraint를 처리한다', () => {
    const shape = [8n, 4n, 16n, 4n];
    const ranges = calcAddressRangesBig(shape, ['1,3', null, '2-4', null]);
    expect(ranges.length).toBeGreaterThan(0);
  });

  it('containsAddressBig로 O(log n) 판정한다', () => {
    const shape = [8n, 4n, 16n, 4n];
    const ranges = calcAddressRangesBig(shape, ['1', null, null, null]);

    // 첫 번째 좌표가 1인 주소는 범위 안
    const wi = new WeightedIndexBig(shape);
    const addr = wi.encode([1n, 2n, 3n, 4n]);
    expect(containsAddressBig(addr, ranges)).toBe(true);

    // 첫 번째 좌표가 2인 주소는 범위 밖
    const addr2 = wi.encode([2n, 2n, 3n, 4n]);
    expect(containsAddressBig(addr2, ranges)).toBe(false);
  });
});
