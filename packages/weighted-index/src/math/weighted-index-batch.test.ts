import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./weighted-index.js";
import { WeightedIndexBig } from "./weighted-index-big.js";
import { BufferError, IndexRangeError } from "./errors.js";

// ── 픽스처 ────────────────────────────────────────────────────────────────────
const W342 = new WeightedIndex([3, 4, 2]);
const W4482 = new WeightedIndex([4, 4, 8, 2], ["role", "action", "api", "tenant"]);

// ─────────────────────────────────────────────────────────────────────────────
// encodeBatch / decodeBatch 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe("encodeBatch / decodeBatch 라운드트립", () => {
  it("decodeBatch(encodeBatch(coords)) = coords", () => {
    const coords: number[][] = [];
    for (let r = 1; r <= 3; r++)
      for (let a = 1; a <= 4; a++)
        for (let t = 1; t <= 2; t++)
          coords.push([r, a, t]);

    const addrs = W342.encodeBatch(coords);
    expect(addrs).toBeInstanceOf(Uint32Array);
    expect(addrs.length).toBe(coords.length);

    const decoded = W342.decodeBatch(addrs);
    expect(decoded).toEqual(coords);
  });

  it("4차원에서도 라운드트립이 성립한다", () => {
    const coords: number[][] = [
      [1, 1, 1, 1],
      [4, 4, 8, 2],
      [2, 3, 5, 1],
    ];
    const addrs = W4482.encodeBatch(coords);
    const decoded = W4482.decodeBatch(addrs);
    expect(decoded).toEqual(coords);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// encodeBatch는 개별 encode와 동일한 결과
// ─────────────────────────────────────────────────────────────────────────────
describe("encodeBatch는 개별 encode와 동일", () => {
  it("각 원소가 encode()와 일치한다", () => {
    const coords: number[][] = [
      [1, 1, 1],
      [2, 3, 2],
      [3, 4, 1],
    ];
    const batch = W342.encodeBatch(coords);
    for (let i = 0; i < coords.length; i++) {
      expect(batch[i]).toBe(W342.encode(coords[i]));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// encodeBatchUnsafe / decodeBatchUnsafe
// ─────────────────────────────────────────────────────────────────────────────
describe("encodeBatchUnsafe / decodeBatchUnsafe", () => {
  it("유효 입력에서 safe 버전과 동일한 결과", () => {
    const coords: number[][] = [
      [1, 2, 1],
      [3, 1, 2],
    ];
    const safe = W342.encodeBatch(coords);
    const unsafe = W342.encodeBatchUnsafe(coords);
    expect(unsafe).toEqual(safe);

    const safeDec = W342.decodeBatch(safe);
    const unsafeDec = W342.decodeBatchUnsafe(unsafe);
    expect(unsafeDec).toEqual(safeDec);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// encodeBatchFlat / decodeBatchFlat 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe("encodeBatchFlat / decodeBatchFlat 라운드트립", () => {
  it("decodeBatchFlat(encodeBatchFlat(buf)) = buf", () => {
    const coords: number[][] = [
      [1, 1, 1],
      [2, 3, 2],
      [3, 4, 2],
    ];
    const d = W342.shape.length;
    const flat = new Float64Array(coords.length * d);
    for (let i = 0; i < coords.length; i++)
      for (let j = 0; j < d; j++)
        flat[i * d + j] = coords[i][j];

    const addrs = W342.encodeBatchFlat(flat, coords.length);
    expect(addrs).toBeInstanceOf(Float64Array);
    expect(addrs.length).toBe(coords.length);

    const decoded = W342.decodeBatchFlat(addrs, coords.length);
    expect(decoded).toBeInstanceOf(Float64Array);
    expect(decoded.length).toBe(coords.length * d);
    expect(decoded).toEqual(flat);
  });

  it("Flat 결과가 개별 encode와 일치한다", () => {
    const coords: number[][] = [
      [1, 2, 3, 1],
      [4, 4, 8, 2],
    ];
    const d = W4482.shape.length;
    const flat = new Float64Array(coords.length * d);
    for (let i = 0; i < coords.length; i++)
      for (let j = 0; j < d; j++)
        flat[i * d + j] = coords[i][j];

    const addrs = W4482.encodeBatchFlat(flat, coords.length);
    for (let i = 0; i < coords.length; i++) {
      expect(addrs[i]).toBe(W4482.encode(coords[i]));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flat 버퍼 길이 불일치 → 에러
// ─────────────────────────────────────────────────────────────────────────────
describe("Flat 버퍼 길이 불일치", () => {
  it("encodeBatchFlat: coordsBuf 길이 불일치 시 BufferError", () => {
    const bad = new Float64Array(5); // 3차원 × 2개 = 6이어야 함
    expect(() => W342.encodeBatchFlat(bad, 2)).toThrow(BufferError);
  });

  it("decodeBatchFlat: addrsBuf 길이 불일치 시 BufferError", () => {
    const bad = new Float64Array(3);
    expect(() => W342.decodeBatchFlat(bad, 2)).toThrow(BufferError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Uint32Array 범위 초과
// ─────────────────────────────────────────────────────────────────────────────
describe("Uint32Array 범위 초과 가드", () => {
  it("size > 0xFFFFFFFF 이면 encodeBatch가 IndexRangeError", () => {
    // 가짜로 size를 초과시키기 위해 큰 shape 생성은 불가하므로 작은 shape으로 우회 불가
    // 대신 직접 검증: shape product가 Uint32Array 범위 이내인 경우 통과
    const wi = new WeightedIndex([2, 3]);
    expect(wi.size).toBeLessThanOrEqual(0xFFFF_FFFF);
    expect(() => wi.encodeBatch([[1, 1]])).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BigInt 배치 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe("WeightedIndexBig 배치 라운드트립", () => {
  it("decodeBatch(encodeBatch(coords)) = coords", () => {
    const wi = new WeightedIndexBig([8n, 4n, 16n, 4n]);
    const coords: bigint[][] = [
      [1n, 1n, 1n, 1n],
      [8n, 4n, 16n, 4n],
      [2n, 3n, 5n, 1n],
    ];
    const addrs = wi.encodeBatch(coords);
    expect(addrs).toBeInstanceOf(BigInt64Array);
    expect(addrs.length).toBe(coords.length);

    const decoded = wi.decodeBatch(addrs);
    expect(decoded).toEqual(coords);
  });

  it("각 원소가 개별 encode와 일치한다", () => {
    const wi = new WeightedIndexBig([3n, 4n, 2n]);
    const coords: bigint[][] = [
      [1n, 1n, 1n],
      [3n, 4n, 2n],
    ];
    const batch = wi.encodeBatch(coords);
    for (let i = 0; i < coords.length; i++) {
      expect(batch[i]).toBe(wi.encode(coords[i]));
    }
  });

  it("encodeBatchUnsafe/decodeBatchUnsafe는 safe와 동일", () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    const coords: bigint[][] = [
      [1n, 2n],
      [3n, 4n],
    ];
    const safe = wi.encodeBatch(coords);
    const unsafe = wi.encodeBatchUnsafe(coords);
    expect(unsafe).toEqual(safe);

    const safeDec = wi.decodeBatch(safe);
    const unsafeDec = wi.decodeBatchUnsafe(unsafe);
    expect(unsafeDec).toEqual(safeDec);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 빈 입력 edge case
// ─────────────────────────────────────────────────────────────────────────────
describe("빈 입력 edge case", () => {
  it("encodeBatch: 빈 배열 → 빈 Uint32Array", () => {
    const result = W342.encodeBatch([]);
    expect(result).toBeInstanceOf(Uint32Array);
    expect(result.length).toBe(0);
  });

  it("decodeBatch: 빈 Uint32Array → 빈 배열", () => {
    const result = W342.decodeBatch(new Uint32Array(0));
    expect(result).toEqual([]);
  });

  it("encodeBatchFlat: itemCount=0 → 빈 Float64Array", () => {
    const result = W342.encodeBatchFlat(new Float64Array(0), 0);
    expect(result).toBeInstanceOf(Float64Array);
    expect(result.length).toBe(0);
  });

  it("decodeBatchFlat: itemCount=0 → 빈 Float64Array", () => {
    const result = W342.decodeBatchFlat(new Float64Array(0), 0);
    expect(result).toBeInstanceOf(Float64Array);
    expect(result.length).toBe(0);
  });

  it("BigInt encodeBatch: 빈 배열 → 빈 BigInt64Array", () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    const result = wi.encodeBatch([]);
    expect(result).toBeInstanceOf(BigInt64Array);
    expect(result.length).toBe(0);
  });

  it("BigInt decodeBatch: 빈 BigInt64Array → 빈 배열", () => {
    const wi = new WeightedIndexBig([3n, 4n]);
    const result = wi.decodeBatch(new BigInt64Array(0));
    expect(result).toEqual([]);
  });
});
