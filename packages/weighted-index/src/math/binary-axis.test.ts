import { describe, it, expect } from "vitest";
import { WeightedIndex } from "./weighted-index.js";
import { BufferError } from "./errors.js";
import {
  packAxis,
  unpackAxis,
  fromPackedAxis,
  toPackedAxis,
} from "./binary-axis.js";

// ── 픽스처 ────────────────────────────────────────────────────────────────────
const W342 = new WeightedIndex([3, 4, 2]);
const W4482 = new WeightedIndex([4, 4, 8, 2], ["role", "action", "api", "tenant"]);

// ─────────────────────────────────────────────────────────────────────────────
// packAxis → unpackAxis 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe("packAxis / unpackAxis 라운드트립", () => {
  it("3D shape [3,4,2] — shape, strides, size 복원", () => {
    const buf = packAxis(W342.shape, W342.strides);
    const { shape, strides, size } = unpackAxis(buf);

    expect(shape).toEqual([...W342.shape]);
    expect(strides).toEqual([...W342.strides]);
    expect(size).toBe(W342.size);
  });

  it("4D shape [4,4,8,2] — shape, strides, size 복원", () => {
    const buf = packAxis(W4482.shape, W4482.strides);
    const { shape, strides, size } = unpackAxis(buf);

    expect(shape).toEqual([...W4482.shape]);
    expect(strides).toEqual([...W4482.strides]);
    expect(size).toBe(W4482.size);
  });

  it("1D edge case: shape [7]", () => {
    const wi = new WeightedIndex([7]);
    const buf = packAxis(wi.shape, wi.strides);
    const { shape, strides, size } = unpackAxis(buf);

    expect(shape).toEqual([7]);
    expect(strides).toEqual([1]);
    expect(size).toBe(7);
  });

  it("큰 차원: shape [1000, 500, 200]", () => {
    const wi = new WeightedIndex([1000, 500, 200]);
    const buf = packAxis(wi.shape, wi.strides);
    const { shape, strides, size } = unpackAxis(buf);

    expect(shape).toEqual([1000, 500, 200]);
    expect(strides).toEqual([...wi.strides]);
    expect(size).toBe(1000 * 500 * 200);
  });

  it("버퍼 크기가 예상과 일치 (8 + d × 12)", () => {
    const buf3 = packAxis([3, 4, 2], [8, 2, 1]);
    expect(buf3.byteLength).toBe(8 + 3 * 12);

    const buf1 = packAxis([5], [1]);
    expect(buf1.byteLength).toBe(8 + 1 * 12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fromPackedAxis — 기능적 WeightedIndex 생성
// ─────────────────────────────────────────────────────────────────────────────
describe("fromPackedAxis — WeightedIndex 기능 검증", () => {
  it("복원된 WeightedIndex로 encode/decode 정상 동작", () => {
    const buf = toPackedAxis(W342);
    const restored = fromPackedAxis(buf);

    expect(restored.shape).toEqual(W342.shape);
    expect(restored.strides).toEqual(W342.strides);
    expect(restored.size).toBe(W342.size);

    // encode/decode 라운드트립
    for (let i = 0; i < W342.size; i++) {
      const coords = W342.decode(i);
      expect(restored.encode(coords)).toBe(i);
      expect(restored.decode(i)).toEqual(coords);
    }
  });

  it("4D 복원 — 모든 주소에서 encode ∘ decode = identity", () => {
    const buf = toPackedAxis(W4482);
    const restored = fromPackedAxis(buf);

    // 샘플 검증 (전수 대신 경계 + 중간값)
    const testIndices = [0, 1, W4482.size - 1, Math.floor(W4482.size / 2)];
    for (const idx of testIndices) {
      expect(restored.encode(restored.decode(idx))).toBe(idx);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toPackedAxis → fromPackedAxis 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
describe("toPackedAxis → fromPackedAxis 라운드트립", () => {
  it("3D shape 라운드트립", () => {
    const restored = fromPackedAxis(toPackedAxis(W342));
    expect(restored.shape).toEqual(W342.shape);
    expect(restored.strides).toEqual(W342.strides);
    expect(restored.size).toBe(W342.size);
  });

  it("1D shape 라운드트립", () => {
    const wi = new WeightedIndex([100]);
    const restored = fromPackedAxis(toPackedAxis(wi));
    expect(restored.shape).toEqual(wi.shape);
    expect(restored.size).toBe(100);
  });

  it("큰 차원 라운드트립 — encode/decode 일관성", () => {
    const wi = new WeightedIndex([50, 30, 20, 10]);
    const restored = fromPackedAxis(toPackedAxis(wi));

    // 100개 무작위 인덱스 검증
    for (let i = 0; i < 100; i++) {
      const idx = Math.floor(Math.random() * wi.size);
      const coords = wi.decode(idx);
      expect(restored.encode(coords)).toBe(idx);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 잘못된 버퍼 → throws
// ─────────────────────────────────────────────────────────────────────────────
describe("잘못된 입력 → BufferError", () => {
  it("빈 ArrayBuffer → throws", () => {
    expect(() => unpackAxis(new ArrayBuffer(0))).toThrow(BufferError);
  });

  it("너무 작은 버퍼 (헤더만) → throws", () => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint32(0, 3, true); // dimCount = 3이지만 데이터 없음
    expect(() => unpackAxis(buf)).toThrow(BufferError);
  });

  it("dimCount = 0 → throws", () => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, 0, true); // dimCount = 0
    expect(() => unpackAxis(buf)).toThrow(BufferError);
  });

  it("빈 shape → packAxis throws", () => {
    expect(() => packAxis([], [])).toThrow(BufferError);
  });

  it("shape/strides 길이 불일치 → packAxis throws", () => {
    expect(() => packAxis([3, 4], [8, 2, 1])).toThrow(BufferError);
  });
});
