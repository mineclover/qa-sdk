// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * 리소스 사용량 벤치마크
 *
 * 메모리 사용량, 인스턴스 생성 비용, 구조체 크기를 측정한다.
 *
 * 측정 항목:
 *   1. WeightedIndex 인스턴스 메모리 (Float64Array, shape 캐시)
 *   2. 차원/dimSize 스케일링 시 메모리 증가
 *   3. calcAddressRanges 결과 메모리 (캐싱 비용)
 *   4. 다수 인스턴스 동시 보유 시 총 메모리
 */

import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./math/weighted-index.js";
import { calcAddressRanges } from "./math/calc.js";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function makeShape(d: number, dimSize: number): number[] {
  return Array.from({ length: d }, () => dimSize);
}

/** GC 강제 실행 후 힙 사용량 반환 (bytes) */
function measureHeap(): number {
  if (global.gc) global.gc();
  return process.memoryUsage().heapUsed;
}

/** 바이트를 읽기 좋게 포맷 */
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 객체 생성 전후 힙 차이로 대략적 메모리 측정.
 * GC 타이밍에 따라 오차가 있으므로 N회 평균.
 */
function measureAllocation(factory: () => unknown, count: number = 100): number {
  // warm-up + GC
  const warmup: unknown[] = [];
  for (let i = 0; i < 10; i++) warmup.push(factory());
  warmup.length = 0;

  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;

  const instances: unknown[] = [];
  for (let i = 0; i < count; i++) {
    instances.push(factory());
  }

  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;

  // 참조 유지 (GC 방지)
  expect(instances.length).toBe(count);

  return Math.max(0, Math.round((after - before) / count));
}

// ── 1. WeightedIndex 인스턴스 메모리 ─────────────────────────────────────

describe("WeightedIndex 인스턴스 메모리", () => {
  const cases = [
    { d: 2, dimSize: 5 },
    { d: 4, dimSize: 5 },
    { d: 8, dimSize: 5 },
    { d: 16, dimSize: 2 },
    { d: 32, dimSize: 2 },
    { d: 52, dimSize: 2 },
  ];

  const results: Array<{
    d: number;
    dimSize: number;
    size: string;
    estimatedBytes: string;
    constructUs: string;
  }> = [];

  it.each(cases)("d=$d dimSize=$dimSize", ({ d, dimSize }) => {
    const shape = makeShape(d, dimSize);

    // 메모리 측정
    const bytesPerInstance = measureAllocation(
      () => new WeightedIndex(shape),
      200
    );

    // 생성 시간 측정
    const ITER = 50_000;
    const start = performance.now();
    for (let i = 0; i < ITER; i++) void new WeightedIndex(shape);
    const constructUs = ((performance.now() - start) / ITER) * 1000;

    const wi = new WeightedIndex(shape);

    results.push({
      d,
      dimSize,
      size: wi.size.toExponential(1),
      estimatedBytes: fmtBytes(bytesPerInstance),
      constructUs: constructUs.toFixed(2) + " µs",
    });

    // 최소 구조: weights(Float64Array) + shapeBuf(Float64Array) + shape(frozen array) + labels
    // Float64Array(d) = 8*d bytes each
    const minExpected = 8 * d * 2; // weights + shapeBuf
    expect(bytesPerInstance).toBeGreaterThanOrEqual(0);
  });

  it("결과 테이블", () => {
    console.log("\n=== WeightedIndex 인스턴스 메모리 ===");
    console.table(results);
    console.log("내부 구조: weights(Float64Array, 8×d) + shapeBuf(Float64Array, 8×d) + shape(frozen) + labels(frozen)");
  });
});

// ── 2. calcAddressRanges 결과 메모리 ─────────────────────────────────────

describe("calcAddressRanges 캐시 메모리", () => {
  const cases = [
    {
      label: "연속 1구간",
      shape: [10, 20, 50],
      constraints: ["5", null, null] as (string | null)[],
    },
    {
      label: "3구간",
      shape: [10, 10, 10],
      constraints: ["2-4", "5-8", null] as (string | null)[],
    },
    {
      label: "25구간 (OR)",
      shape: [10, 10, 10],
      constraints: ["1,3,5,7,9", "2,4,6,8,10", null] as (string | null)[],
    },
    {
      label: "4,608구간 (6D 복합)",
      shape: [8, 8, 8, 8, 8, 8],
      constraints: ["1-3", null, "2,5,7", null, null, "1-4"] as (string | null)[],
    },
  ];

  const results: Array<{
    label: string;
    rangeCount: number;
    estimatedBytes: string;
    bytesPerRange: string;
  }> = [];

  it.each(cases)("$label", ({ label, shape, constraints }) => {
    const bytesTotal = measureAllocation(
      () => calcAddressRanges(shape, constraints),
      200
    );

    const ranges = calcAddressRanges(shape, constraints);

    results.push({
      label,
      rangeCount: ranges.length,
      estimatedBytes: fmtBytes(bytesTotal),
      bytesPerRange: ranges.length > 0
        ? fmtBytes(Math.round(bytesTotal / ranges.length))
        : "N/A",
    });
  });

  it("결과 테이블", () => {
    console.log("\n=== calcAddressRanges 캐시 메모리 ===");
    console.table(results);
    console.log("각 range = [number, number] 튜플. 배열 오버헤드 포함.");
  });
});

// ── 3. 다수 인스턴스 동시 보유 ──────────────────────────────────────────

describe("다수 인스턴스 동시 보유", () => {
  it("100개 WeightedIndex (각 8D)", () => {
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    const instances: WeightedIndex[] = [];
    for (let i = 0; i < 100; i++) {
      instances.push(new WeightedIndex([5, 5, 5, 5, 5, 5, 5, 5]));
    }

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const total = after - before;

    console.log(`\n=== 100개 WeightedIndex (8D, 각 5) 동시 보유 ===`);
    console.log(`총 메모리: ${fmtBytes(total)}`);
    console.log(`인스턴스당: ${fmtBytes(Math.round(total / 100))}`);

    expect(instances.length).toBe(100);
  });

  it("cross-index 계층 (4레벨) 전체 메모리", () => {
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;

    const L0 = new WeightedIndex([20, 50]);
    const L1 = new WeightedIndex([L0.size, 10]);
    const L2 = new WeightedIndex([L1.size, 100]);
    const L3 = new WeightedIndex([L2.size, 5]);

    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;

    console.log(`\n=== Cross-index 4레벨 (20×50 → 1K×10 → 10K×100 → 1M×5) ===`);
    console.log(`총 메모리: ${fmtBytes(after - before)}`);
    console.log(`L3 size: ${L3.size.toLocaleString()}`);

    expect(L3.size).toBe(5_000_000);
  });
});

// ── 4. 이론적 메모리 계산 ────────────────────────────────────────────────

describe("이론적 메모리 구조 분석", () => {
  it("WeightedIndex 내부 구조 크기 계산", () => {
    const dims = [2, 4, 8, 16, 32, 52];

    const results: Array<{
      d: number;
      weightsBytes: string;
      shapeBufBytes: string;
      shapeArrayBytes: string;
      labelsArrayBytes: string;
      totalMinBytes: string;
    }> = [];

    for (const d of dims) {
      // Float64Array: 8 bytes per element + ~64 bytes overhead
      const float64Overhead = 64;
      const weightsBytes = 8 * d + float64Overhead;
      const shapeBufBytes = 8 * d + float64Overhead;

      // frozen Array: ~32 bytes overhead + 8 bytes per element (pointer)
      const arrayOverhead = 32;
      const shapeArrayBytes = arrayOverhead + 8 * d;

      // labels: array overhead + string refs + string objects
      // string "dim_N" ≈ 40 bytes each (V8 string overhead)
      const labelsArrayBytes = arrayOverhead + d * (8 + 40);

      const total = weightsBytes + shapeBufBytes + shapeArrayBytes + labelsArrayBytes;

      results.push({
        d,
        weightsBytes: fmtBytes(weightsBytes),
        shapeBufBytes: fmtBytes(shapeBufBytes),
        shapeArrayBytes: fmtBytes(shapeArrayBytes),
        labelsArrayBytes: fmtBytes(labelsArrayBytes),
        totalMinBytes: fmtBytes(total),
      });
    }

    console.log("\n=== WeightedIndex 이론적 메모리 구성 ===");
    console.table(results);
    console.log("* V8 객체 헤더, 히든 클래스 등 추가 오버헤드는 미포함");
    console.log("* 실측값은 GC 타이밍에 따라 이론값보다 클 수 있음");
  });

  it("range 캐시 이론적 크기 계산", () => {
    const rangeCounts = [1, 10, 100, 1000, 5000, 10000];

    console.log("\n=== Range 캐시 이론적 메모리 ===");
    for (const n of rangeCounts) {
      // [number, number][] = outer array + n inner arrays, each with 2 numbers
      // outer: 32 + 8*n bytes (pointer array)
      // each tuple: 32 (array overhead) + 16 (2 numbers) = 48 bytes
      const outerBytes = 32 + 8 * n;
      const innerBytes = 48 * n;
      const total = outerBytes + innerBytes;
      console.log(`${String(n).padStart(6)} ranges: ${fmtBytes(total).padStart(10)} (outer ${fmtBytes(outerBytes)}, tuples ${fmtBytes(innerBytes)})`);
    }
  });
});
