// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * D-4 계약: stride 공식 일치.
 *
 * calcWeights(shape)와 new WeightedIndex(shape).strides가 동일함을 검증한다.
 * Phase 2에서 WeightedIndex가 calcWeights()를 호출하도록 교체할 때 이 계약이 안전망이 된다.
 */
import { describe, expect, it } from 'vitest';
import { WeightedIndex, calcWeights } from 'weighted-index';

describe('D-4: stride 공식 일치', () => {
  const shapes: { label: string; shape: number[] }[] = [
    { label: '1D', shape: [10] },
    { label: '2D', shape: [3, 4] },
    { label: '3D', shape: [8, 4, 5] },
    { label: '4D (permission-like)', shape: [10, 3, 20, 4] },
    { label: '6D 고차원', shape: [3, 4, 2, 5, 3, 2] },
    { label: '8D', shape: [2, 3, 4, 5, 2, 3, 4, 2] },
    { label: '모든 차원 크기 1', shape: [1, 1, 1, 1] },
    { label: '큰 2D', shape: [1000, 1000] },
    { label: '비대칭', shape: [100, 2, 50, 3, 10] },
  ];

  for (const { label, shape } of shapes) {
    it(`${label}: calcWeights() === WeightedIndex.strides — shape=${JSON.stringify(shape)}`, () => {
      const fromCalc = calcWeights(shape);
      const fromWI = new WeightedIndex(shape).strides;

      expect(fromCalc).toEqual([...fromWI]);
    });
  }

  it('stride 공식이 정의와 일치: W[i] = Π_{j>i} shape[j]', () => {
    const shape = [8, 4, 5, 4];
    const strides = calcWeights(shape);

    // W[3] = 1 (마지막)
    expect(strides[3]).toBe(1);
    // W[2] = shape[3] = 4
    expect(strides[2]).toBe(4);
    // W[1] = shape[2] * shape[3] = 5 * 4 = 20
    expect(strides[1]).toBe(20);
    // W[0] = shape[1] * shape[2] * shape[3] = 4 * 5 * 4 = 80
    expect(strides[0]).toBe(80);
  });

  it('stride를 사용한 encode/decode가 WeightedIndex와 동일하다', () => {
    const shape = [3, 4, 5];
    const wi = new WeightedIndex(shape);
    const strides = calcWeights(shape);

    for (let a = 1; a <= shape[0]; a++) {
      for (let b = 1; b <= shape[1]; b++) {
        for (let c = 1; c <= shape[2]; c++) {
          // calcWeights 기반 수동 encode
          const manual = (a - 1) * strides[0] + (b - 1) * strides[1] + (c - 1) * strides[2];
          // WeightedIndex encode
          const wiAddr = wi.encode([a, b, c]);
          expect(manual).toBe(wiAddr);
        }
      }
    }
  });

  it('size도 일치: strides[0] * shape[0] === WeightedIndex.size', () => {
    for (const { shape } of shapes) {
      const strides = calcWeights(shape);
      const wi = new WeightedIndex(shape);
      expect(strides[0] * shape[0]).toBe(wi.size);
    }
  });
});
