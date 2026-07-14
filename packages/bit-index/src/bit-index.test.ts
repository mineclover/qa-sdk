// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, it, expect } from 'vitest';
import { BitIndex, BitIndexBig, createBitIndex } from './bit-index.js';
import { WeightedIndex } from 'weighted-index';

// ═════════════════════════════════════════════════════════════════════════════
//  1. 생성자 검증
// ═════════════════════════════════════════════════════════════════════════════

describe('생성자', () => {
  it('기본 shape + labels', () => {
    const idx = new BitIndex([10, 50, 8, 20], ['region', 'page', 'action', 'resource']);
    expect(idx.shape).toEqual([10, 50, 8, 20]);
    expect(idx.labels).toEqual(['region', 'page', 'action', 'resource']);
    expect(idx.totalBits).toBe(18); // 4+6+3+5
    expect(idx.totalBytes).toBe(3);
  });

  it('labels 생략 시 dim_N 자동 생성', () => {
    const idx = new BitIndex([3, 4]);
    expect(idx.labels).toEqual(['dim_0', 'dim_1']);
  });

  it('빈 shape → throw', () => {
    expect(() => new BitIndex([])).toThrow();
  });

  it('shape에 0 → throw', () => {
    expect(() => new BitIndex([3, 0, 2])).toThrow();
  });

  it('labels 길이 불일치 → throw', () => {
    expect(() => new BitIndex([3, 4], ['a'])).toThrow();
  });

  it('totalBits > 53 → BitIndex throw, BitIndexBig OK', () => {
    expect(() => new BitIndex(new Array(14).fill(8))).not.toThrow();
    expect(() => new BitIndex(new Array(18).fill(8))).toThrow('totalBits');
    expect(() => new BitIndexBig(new Array(18).fill(8))).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  2. 전단사 증명 — 전수 검사
// ═════════════════════════════════════════════════════════════════════════════

describe('전단사 증명', () => {
  it('shape [3,4,2] — 모든 좌표가 고유 packed 값, 역변환 정확', () => {
    const idx = new BitIndex([3, 4, 2], ['a', 'b', 'c']);
    const seen = new Set<number>();

    for (let a = 1; a <= 3; a++) {
      for (let b = 1; b <= 4; b++) {
        for (let c = 1; c <= 2; c++) {
          const packed = idx.encode([a, b, c]);
          expect(seen.has(packed)).toBe(false);
          seen.add(packed);
          expect(idx.decode(packed)).toEqual([a, b, c]);
        }
      }
    }
    expect(seen.size).toBe(24);
  });

  it('shape [5,8,20] — 전체 800건 라운드트립', () => {
    const idx = new BitIndex([5, 8, 20]);
    let count = 0;
    for (let a = 1; a <= 5; a++) {
      for (let b = 1; b <= 8; b++) {
        for (let c = 1; c <= 20; c++) {
          expect(idx.decode(idx.encode([a, b, c]))).toEqual([a, b, c]);
          count++;
        }
      }
    }
    expect(count).toBe(800);
  });

  it('BigInt 전수 검사 [3,4,2]', () => {
    const idx = new BitIndexBig([3, 4, 2], ['a', 'b', 'c']);
    const seen = new Set<bigint>();
    for (let a = 1; a <= 3; a++) {
      for (let b = 1; b <= 4; b++) {
        for (let c = 1; c <= 2; c++) {
          const packed = idx.encode([a, b, c]);
          expect(seen.has(packed)).toBe(false);
          seen.add(packed);
          expect(idx.decode(packed)).toEqual([a, b, c]);
        }
      }
    }
    expect(seen.size).toBe(24);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  3. encode / decode 기본 동작
// ═════════════════════════════════════════════════════════════════════════════

describe('encode / decode', () => {
  const idx = new BitIndex([10, 50, 8, 20], ['region', 'page', 'action', 'resource']);

  it('최소 좌표 → 0', () => {
    expect(idx.encode([1, 1, 1, 1])).toBe(0);
    expect(idx.decode(0)).toEqual([1, 1, 1, 1]);
  });

  it('최대 좌표 라운드트립', () => {
    const packed = idx.encode([10, 50, 8, 20]);
    expect(idx.decode(packed)).toEqual([10, 50, 8, 20]);
  });

  it('Record 기반', () => {
    const packed = idx.encodeFromRecord({ region: 3, page: 25, action: 5, resource: 12 });
    expect(idx.decodeToRecord(packed)).toEqual({ region: 3, page: 25, action: 5, resource: 12 });
  });

  it('범위 초과 → throw', () => {
    expect(() => idx.encode([11, 1, 1, 1])).toThrow();
    expect(() => idx.encode([1, 1, 1, 0])).toThrow();
  });

  it('유효하지 않은 packed (구멍) → decode throw', () => {
    const invalidPacked = 0b1111_000000_000_00000;
    expect(() => idx.decode(invalidPacked)).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  4. O(1) 차원 추출
// ═════════════════════════════════════════════════════════════════════════════

describe('O(1) 차원 추출', () => {
  const idx = new BitIndex([10, 50, 8, 20], ['region', 'page', 'action', 'resource']);
  const coords = [3, 25, 5, 12];

  it('extractDim — 인덱스 기반', () => {
    const packed = idx.encode(coords);
    expect(idx.extractDim(packed, 0)).toBe(3);
    expect(idx.extractDim(packed, 1)).toBe(25);
    expect(idx.extractDim(packed, 2)).toBe(5);
    expect(idx.extractDim(packed, 3)).toBe(12);
  });

  it('extractDimByLabel', () => {
    const packed = idx.encode(coords);
    expect(idx.extractDimByLabel(packed, 'region')).toBe(3);
    expect(idx.extractDimByLabel(packed, 'resource')).toBe(12);
  });

  it('extractDims — 부분 추출', () => {
    const packed = idx.encode(coords);
    expect(idx.extractDims(packed, [0, 1, 2])).toEqual({ region: 3, page: 25, action: 5 });
  });

  it('extractDimsByLabel', () => {
    const packed = idx.encode(coords);
    expect(idx.extractDimsByLabel(packed, ['region', 'resource'])).toEqual({
      region: 3,
      resource: 12,
    });
  });

  it('한 차원 변경 → 다른 차원 불변', () => {
    for (let r = 1; r <= 10; r++) {
      const packed = idx.encode([r, 25, 5, 12]);
      expect(idx.extractDim(packed, 1)).toBe(25);
      expect(idx.extractDim(packed, 2)).toBe(5);
      expect(idx.extractDim(packed, 3)).toBe(12);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  5. BigInt 차원 추출
// ═════════════════════════════════════════════════════════════════════════════

describe('BigInt 차원 추출', () => {
  const idx = new BitIndexBig(new Array(18).fill(8));

  it('encode → extractDim 라운드트립', () => {
    const coords = Array.from({ length: 18 }, (_, i) => (i % 7) + 1);
    const packed = idx.encode(coords);
    for (let i = 0; i < 18; i++) {
      expect(idx.extractDim(packed, i)).toBe(coords[i]);
    }
  });

  it('부분 추출', () => {
    const coords = Array.from({ length: 18 }, (_, i) => (i % 7) + 1);
    const packed = idx.encode(coords);
    const subset = idx.extractDims(packed, [0, 5, 17]);
    expect(subset.dim_0).toBe(coords[0]);
    expect(subset.dim_5).toBe(coords[5]);
    expect(subset.dim_17).toBe(coords[17]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  6. WeightedIndex와의 비교
// ═════════════════════════════════════════════════════════════════════════════

describe('WeightedIndex vs BitIndex', () => {
  const shape = [10, 50, 8, 20];
  const wi = new WeightedIndex(shape);
  const bi = new BitIndex(shape);

  it('동일 좌표 → 다른 인코딩 (의도된 비호환)', () => {
    const coords = [3, 25, 5, 12];
    expect(wi.encode(coords)).not.toBe(bi.encode(coords));
    expect(wi.decode(wi.encode(coords))).toEqual(coords);
    expect(bi.decode(bi.encode(coords))).toEqual(coords);
  });

  it('공간 비교: bit-index ≥ mixed-radix', () => {
    expect(bi.totalBits).toBe(18);
    expect(Math.ceil(Math.log2(wi.size))).toBe(17);
  });

  it('2의 거듭제곱 shape → 공간 동일', () => {
    const s2 = [8, 16, 4, 32];
    const wi2 = new WeightedIndex(s2);
    const bi2 = new BitIndex(s2);
    expect(bi2.totalBits).toBe(Math.ceil(Math.log2(wi2.size)));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  7. 직렬화
// ═════════════════════════════════════════════════════════════════════════════

describe('직렬화', () => {
  const idx = new BitIndex([10, 50, 8, 20]);
  const coords = [3, 25, 5, 12];

  it('bytes 라운드트립', () => {
    expect(idx.fromBytes(idx.toBytes(coords))).toEqual(coords);
  });

  it('hex 라운드트립', () => {
    expect(idx.fromHex(idx.toHex(coords))).toEqual(coords);
  });

  it('BigInt bytes 라운드트립', () => {
    const big = new BitIndexBig([10, 50, 8, 20]);
    expect(big.fromBytes(big.toBytes(coords))).toEqual(coords);
  });

  it('BigInt hex 라운드트립', () => {
    const big = new BitIndexBig([10, 50, 8, 20]);
    expect(big.fromHex(big.toHex(coords))).toEqual(coords);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  8. createBitIndex 팩토리
// ═════════════════════════════════════════════════════════════════════════════

describe('createBitIndex', () => {
  it('작은 shape → BitIndex', () => {
    expect(createBitIndex([10, 20, 5])).toBeInstanceOf(BitIndex);
  });

  it('큰 shape → BitIndexBig', () => {
    expect(createBitIndex(new Array(18).fill(8))).toBeInstanceOf(BitIndexBig);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  9. Unsafe API
// ═════════════════════════════════════════════════════════════════════════════

describe('Unsafe API', () => {
  it('Number 라운드트립', () => {
    const idx = new BitIndex([10, 50, 8, 20]);
    const coords = [3, 25, 5, 12];
    expect(idx.decodeUnsafe(idx.encodeUnsafe(coords))).toEqual(coords);
  });

  it('BigInt 라운드트립', () => {
    const idx = new BitIndexBig([10, 50, 8, 20]);
    expect(idx.decodeUnsafe(idx.encodeUnsafe([7, 42, 3, 18]))).toEqual([7, 42, 3, 18]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  10. 실사용: 캐시 키 추출
// ═════════════════════════════════════════════════════════════════════════════

describe('실사용: 비트 시프트 그룹핑', () => {
  const idx = new BitIndex([10, 50, 8, 20], ['region', 'page', 'action', 'resource']);

  it('같은 region+page → 같은 상위 비트', () => {
    const a = idx.encode([3, 25, 1, 1]);
    const b = idx.encode([3, 25, 8, 20]);
    expect(a >> 8).toBe(b >> 8); // action(3b)+resource(5b) = 8 bits 제거
  });

  it('다른 region → 다른 상위 비트', () => {
    const a = idx.encode([3, 25, 1, 1]);
    const c = idx.encode([4, 25, 1, 1]);
    expect(a >> 8).not.toBe(c >> 8);
  });
});
