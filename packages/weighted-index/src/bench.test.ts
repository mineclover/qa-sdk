// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * WeightedIndex 차원 수 확장 벤치마크
 *
 * 목적: 차원 수(d)가 증가할 때 encode/decode/range-query 성능이
 *       어떻게 변하는지 측정하여 안전한 운영 범위를 파악한다.
 *
 * 측정 항목:
 *   1. 생성(construction) — shape 검증 + weight 계산
 *   2. encode / encodeUnsafe — 좌표 → 정수
 *   3. decode / decodeUnsafe / decodeTo — 정수 → 좌표
 *   4. calcAddressRanges — 부분 고정 범위 탐색
 *   5. MAX_SAFE_INTEGER 근접 시 shape 한계
 */

import { describe, it, expect } from 'vitest';
import { WeightedIndex } from './math/weighted-index.js';
import { calcAddressRanges } from './math/calc.js';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

/** d차원, 각 차원 크기 dimSize인 shape 생성 */
function makeShape(d: number, dimSize: number): number[] {
  return Array.from({ length: d }, () => dimSize);
}

/** shape의 중앙 좌표 생성 (1-based) */
function midCoords(shape: readonly number[]): number[] {
  return shape.map((s) => Math.ceil(s / 2));
}

/** 고정밀 시간 측정 (ms) */
function bench(
  fn: () => void,
  iterations: number,
): { totalMs: number; opsPerSec: number; avgNs: number } {
  // warm-up
  for (let i = 0; i < Math.min(iterations, 1000); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;

  return {
    totalMs,
    opsPerSec: Math.round((iterations / totalMs) * 1000),
    avgNs: Math.round((totalMs / iterations) * 1_000_000),
  };
}

// ── 1. 차원 수 확장 한계 탐색 ──────────────────────────────────────────────

describe('차원 수 한계 (dimSize=2 기준)', () => {
  // dimSize=2일 때 size = 2^d, MAX_SAFE_INTEGER = 2^53 - 1 → d ≤ 52
  const cases = [2, 4, 8, 16, 32, 48, 52];

  it.each(cases)('d=%d 생성 가능', (d) => {
    const wi = new WeightedIndex(makeShape(d, 2));
    expect(wi.size).toBe(2 ** d);
  });

  it('d=53 (dimSize=2) → 2^53 > MAX_SAFE_INTEGER 초과로 생성 불가', () => {
    expect(() => new WeightedIndex(makeShape(53, 2))).toThrow('MAX_SAFE_INTEGER');
  });

  it('dimSize=3 한계 탐색', () => {
    // 3^d ≤ 2^53 → d ≤ 33 (3^33 ≈ 5.56×10^15 < 9.0×10^15)
    const wi33 = new WeightedIndex(makeShape(33, 3));
    expect(wi33.size).toBe(3 ** 33);

    expect(() => new WeightedIndex(makeShape(34, 3))).toThrow('MAX_SAFE_INTEGER');
  });

  it('dimSize=10 한계 탐색', () => {
    // 10^d ≤ 2^53 → d ≤ 15 (10^15 < 9.0×10^15)
    const wi15 = new WeightedIndex(makeShape(15, 10));
    expect(wi15.size).toBe(10 ** 15);

    expect(() => new WeightedIndex(makeShape(16, 10))).toThrow('MAX_SAFE_INTEGER');
  });
});

// ── 2. encode/decode 속도 벤치마크 ─────────────────────────────────────────

describe('encode/decode 벤치마크', () => {
  const dims = [2, 4, 8, 16, 32, 52];
  const ITERATIONS = 100_000;

  const results: Array<{
    d: number;
    size: string;
    constructMs: string;
    encodeOps: string;
    encodeUnsafeOps: string;
    decodeOps: string;
    decodeUnsafeOps: string;
    decodeToOps: string;
  }> = [];

  it.each(dims)('d=%d (dimSize=2) 성능 측정', (d) => {
    // Construction
    const constructStart = performance.now();
    const wi = new WeightedIndex(makeShape(d, 2));
    const constructMs = performance.now() - constructStart;

    const coords = midCoords(wi.shape);
    const idx = wi.encodeUnsafe(coords);
    const outBuf = new Array<number>(d);

    // encode (safe)
    const enc = bench(() => wi.encode(coords), ITERATIONS);

    // encodeUnsafe
    const encU = bench(() => wi.encodeUnsafe(coords), ITERATIONS);

    // decode (safe)
    const dec = bench(() => wi.decode(idx), ITERATIONS);

    // decodeUnsafe
    const decU = bench(() => wi.decodeUnsafe(idx), ITERATIONS);

    // decodeTo (zero-alloc)
    const decTo = bench(() => wi.decodeToUnsafe(idx, outBuf), ITERATIONS);

    results.push({
      d,
      size: wi.size.toExponential(1),
      constructMs: constructMs.toFixed(3),
      encodeOps: enc.opsPerSec.toLocaleString(),
      encodeUnsafeOps: encU.opsPerSec.toLocaleString(),
      decodeOps: dec.opsPerSec.toLocaleString(),
      decodeUnsafeOps: decU.opsPerSec.toLocaleString(),
      decodeToOps: decTo.opsPerSec.toLocaleString(),
    });

    // 기본 정합성 검증
    expect(wi.decode(wi.encode(coords))).toEqual(coords);
  });

  it('결과 테이블 출력', () => {
    console.log('\n=== encode/decode 벤치마크 (100K iterations, dimSize=2) ===');
    console.table(results);
  });
});

// ── 3. 큰 dimSize에서의 성능 ───────────────────────────────────────────────

describe('dimSize 확장 벤치마크 (d=4 고정)', () => {
  const dimSizes = [3, 10, 50, 100, 500, 1000];
  const ITERATIONS = 100_000;

  const results: Array<{
    dimSize: number;
    size: string;
    encodeUnsafeOps: string;
    decodeToOps: string;
  }> = [];

  it.each(dimSizes)('dimSize=%d', (dimSize) => {
    const wi = new WeightedIndex(makeShape(4, dimSize));
    const coords = midCoords(wi.shape);
    const idx = wi.encodeUnsafe(coords);
    const outBuf = new Array<number>(4);

    const encU = bench(() => wi.encodeUnsafe(coords), ITERATIONS);
    const decTo = bench(() => wi.decodeToUnsafe(idx, outBuf), ITERATIONS);

    results.push({
      dimSize,
      size: wi.size.toExponential(1),
      encodeUnsafeOps: encU.opsPerSec.toLocaleString(),
      decodeToOps: decTo.opsPerSec.toLocaleString(),
    });

    expect(wi.decode(wi.encode(coords))).toEqual(coords);
  });

  it('결과 테이블 출력', () => {
    console.log('\n=== dimSize 확장 벤치마크 (d=4, 100K iterations) ===');
    console.table(results);
  });
});

// ── 4. calcAddressRanges 벤치마크 ──────────────────────────────────────────

describe('calcAddressRanges 벤치마크', () => {
  // 자유 차원 수에 따른 스케일링 관찰
  describe('자유 차원 수 증가 (shape=[5,5,5,...], d 증가)', () => {
    const dims = [2, 4, 6, 8, 10, 12];

    const results: Array<{
      d: number;
      freeDims: number;
      totalRanges: number;
      ops: string;
      avgNs: string;
    }> = [];

    it.each(dims)('d=%d (1차원 고정, 나머지 자유)', (d) => {
      const shape = makeShape(d, 5);
      // 첫 번째 차원만 고정, 나머지 wildcard
      const constraints = ['3', ...Array.from({ length: d - 1 }, () => null)] as Array<
        string | null
      >;

      const iterations = d <= 8 ? 10_000 : 1_000;
      let ranges: [number, number][] = [];

      const result = bench(() => {
        ranges = calcAddressRanges(shape, constraints);
      }, iterations);

      results.push({
        d,
        freeDims: d - 1,
        totalRanges: ranges.length,
        ops: result.opsPerSec.toLocaleString(),
        avgNs: result.avgNs.toLocaleString(),
      });

      // 범위가 연속이면 1개 구간으로 merge됨 (첫 차원 고정 → 1 구간)
      expect(ranges.length).toBeGreaterThan(0);
    });

    it('결과 테이블 출력', () => {
      console.log('\n=== calcAddressRanges: 자유 차원 수 증가 (shape=[5,...]) ===');
      console.table(results);
    });
  });

  describe('고정 차원 수 증가 (d=8 고정, shape=[5,...,5])', () => {
    const fixedCounts = [1, 2, 4, 6, 7];

    const results: Array<{
      fixedDims: number;
      freeDims: number;
      totalRanges: number;
      ops: string;
      avgNs: string;
    }> = [];

    it.each(fixedCounts)('고정 %d개 차원', (fixedCount) => {
      const d = 8;
      const shape = makeShape(d, 5);
      const constraints: Array<string | null> = Array.from({ length: d }, (_, i) =>
        i < fixedCount ? '3' : null,
      );

      const iterations = fixedCount >= 6 ? 10_000 : 1_000;
      let ranges: [number, number][] = [];

      const result = bench(() => {
        ranges = calcAddressRanges(shape, constraints);
      }, iterations);

      results.push({
        fixedDims: fixedCount,
        freeDims: d - fixedCount,
        totalRanges: ranges.length,
        ops: result.opsPerSec.toLocaleString(),
        avgNs: result.avgNs.toLocaleString(),
      });

      expect(ranges.length).toBeGreaterThan(0);
    });

    it('결과 테이블 출력', () => {
      console.log('\n=== calcAddressRanges: 고정 차원 수 증가 (d=8, dimSize=5) ===');
      console.table(results);
    });
  });

  describe('비연속 다중 값 제약 (OR 쿼리)', () => {
    const cases = [
      { label: '단일값 x 2dim', shape: [10, 10, 10], constraints: ['3', '5', null] },
      { label: '범위 x 2dim', shape: [10, 10, 10], constraints: ['2-4', '5-8', null] },
      { label: 'OR 다중값', shape: [10, 10, 10], constraints: ['1,3,5,7,9', '2,4,6,8,10', null] },
      {
        label: '6dim 복합',
        shape: [8, 8, 8, 8, 8, 8],
        constraints: ['1-3', null, '2,5,7', null, null, '1-4'],
      },
    ] as const;

    const results: Array<{
      label: string;
      totalRanges: number;
      ops: string;
      avgNs: string;
    }> = [];

    it.each(cases)('$label', ({ label, shape, constraints }) => {
      let ranges: [number, number][] = [];

      const result = bench(() => {
        ranges = calcAddressRanges([...shape], [...constraints]);
      }, 10_000);

      results.push({
        label,
        totalRanges: ranges.length,
        ops: result.opsPerSec.toLocaleString(),
        avgNs: result.avgNs.toLocaleString(),
      });

      expect(ranges.length).toBeGreaterThan(0);
    });

    it('결과 테이블 출력', () => {
      console.log('\n=== calcAddressRanges: 복합 제약 쿼리 ===');
      console.table(results);
    });
  });
});

// ── 5. 실용 시나리오 벤치마크 ──────────────────────────────────────────────

describe('실용 시나리오', () => {
  it('SaaS 권한 모델 (role×action×resource = 10×20×50)', () => {
    const wi = new WeightedIndex([10, 20, 50], ['role', 'action', 'resource']);
    const coords = [5, 10, 25];
    const idx = wi.encode(coords);
    const outBuf = new Array<number>(3);

    const ITER = 500_000;
    const enc = bench(() => wi.encodeUnsafe(coords), ITER);
    const dec = bench(() => wi.decodeToUnsafe(idx, outBuf), ITER);
    const ranges = bench(() => calcAddressRanges([10, 20, 50], ['5', null, null]), 100_000);

    console.log('\n=== SaaS 권한 모델 (3D: 10×20×50 = 10,000) ===');
    console.log(`encode:  ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode:  ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
    console.log(`ranges:  ${ranges.opsPerSec.toLocaleString()} ops/s (${ranges.avgNs}ns)`);

    expect(wi.decode(idx)).toEqual(coords);
  });

  it('대규모 설정 (8D: 10×8×6×5×4×3×3×2 = 172,800)', () => {
    const shape = [10, 8, 6, 5, 4, 3, 3, 2];
    const wi = new WeightedIndex(shape);
    const coords = midCoords(shape);
    const idx = wi.encode(coords);
    const outBuf = new Array<number>(8);

    const ITER = 200_000;
    const enc = bench(() => wi.encodeUnsafe(coords), ITER);
    const dec = bench(() => wi.decodeToUnsafe(idx, outBuf), ITER);
    const ranges = bench(
      () => calcAddressRanges(shape, ['5', null, '3', null, null, null, null, '1']),
      10_000,
    );

    console.log('\n=== 대규모 설정 (8D: 172,800) ===');
    console.log(`encode:  ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode:  ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
    console.log(`ranges:  ${ranges.opsPerSec.toLocaleString()} ops/s (${ranges.avgNs}ns)`);

    expect(wi.decode(idx)).toEqual(coords);
  });

  it('극한 차원 (32D: 각 2 = 4,294,967,296)', () => {
    const shape = makeShape(32, 2);
    const wi = new WeightedIndex(shape);
    const coords = midCoords(shape); // 모두 1
    const idx = wi.encode(coords);
    const outBuf = new Array<number>(32);

    const ITER = 100_000;
    const enc = bench(() => wi.encodeUnsafe(coords), ITER);
    const dec = bench(() => wi.decodeToUnsafe(idx, outBuf), ITER);

    console.log('\n=== 극한 차원 (32D: 2^32 = 4.3B) ===');
    console.log(`encode:  ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode:  ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);

    expect(wi.decode(idx)).toEqual(coords);
  });

  it('MAX_SAFE_INTEGER 근접 (52D: 각 2 = 2^52)', () => {
    const shape = makeShape(52, 2);
    const wi = new WeightedIndex(shape);
    expect(wi.size).toBe(2 ** 52);

    const coords = makeShape(52, 2); // 모두 2 (최대값)
    const idx = wi.encode(coords);
    expect(idx).toBe(wi.size - 1);

    const outBuf = new Array<number>(52);
    const ITER = 50_000;
    const enc = bench(() => wi.encodeUnsafe(coords), ITER);
    const dec = bench(() => wi.decodeToUnsafe(idx, outBuf), ITER);

    console.log('\n=== MAX_SAFE_INTEGER 근접 (52D: 2^52) ===');
    console.log(`encode:  ${enc.opsPerSec.toLocaleString()} ops/s (${enc.avgNs}ns)`);
    console.log(`decode:  ${dec.opsPerSec.toLocaleString()} ops/s (${dec.avgNs}ns)`);
    console.log(`size:    ${wi.size.toExponential(2)}`);

    expect(wi.decode(idx)).toEqual(coords);
  });
});
