// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, it, expect } from 'vitest';
import { IndexBridge } from './bridge.js';
import { WeightedIndex, calcAddressRanges } from 'weighted-index';
import { BitIndex } from './bit-index.js';

const SHAPE = [5, 8, 20];
const LABELS = ['role', 'action', 'resource'];

// ═════════════════════════════════════════════════════════════════════════════
//  기본 변환
// ═════════════════════════════════════════════════════════════════════════════

describe('IndexBridge 기본 변환', () => {
  const bridge = new IndexBridge(SHAPE, LABELS);

  it('toBit → toWeighted 왕복 = 원본 WI index', () => {
    for (let i = 0; i < bridge.wi.size; i++) {
      expect(bridge.toWeighted(bridge.toBit(i))).toBe(i);
    }
  });

  it('toWeighted → toBit 왕복 = 원본 BI packed', () => {
    for (let r = 1; r <= 5; r++) {
      for (let a = 1; a <= 8; a++) {
        for (let res = 1; res <= 20; res++) {
          const biPacked = bridge.bi.encode([r, a, res]);
          expect(bridge.toBit(bridge.toWeighted(biPacked))).toBe(biPacked);
        }
      }
    }
  });

  it('좌표 보존: WI → BI → 좌표 추출 일치', () => {
    const coords = [3, 5, 12];
    const wiIndex = bridge.wi.encode(coords);
    const biPacked = bridge.toBit(wiIndex);

    expect(bridge.bi.extractDim(biPacked, 0)).toBe(3);
    expect(bridge.bi.extractDim(biPacked, 1)).toBe(5);
    expect(bridge.bi.extractDim(biPacked, 2)).toBe(12);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  배치 변환
// ═════════════════════════════════════════════════════════════════════════════

describe('IndexBridge 배치 변환', () => {
  const bridge = new IndexBridge(SHAPE, LABELS);

  it('toBitBatch: WI 주소 배열 → BI packed 배열', () => {
    const wiIndices = [0, 1, 42, 100, bridge.wi.size - 1];
    const biPackeds = bridge.toBitBatch(wiIndices);

    expect(biPackeds).toHaveLength(wiIndices.length);
    for (let i = 0; i < wiIndices.length; i++) {
      expect(biPackeds[i]).toBe(bridge.toBit(wiIndices[i]));
    }
  });

  it('toWeightedBatch: BI packed 배열 → WI 주소 배열', () => {
    const coords = [
      [1, 1, 1],
      [3, 5, 12],
      [5, 8, 20],
    ];
    const biPackeds = coords.map((c) => bridge.bi.encode(c));
    const wiIndices = bridge.toWeightedBatch(biPackeds);

    for (let i = 0; i < coords.length; i++) {
      expect(wiIndices[i]).toBe(bridge.wi.encode(coords[i]));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  실사용: DB → 인메모리 필터 → DB
// ═════════════════════════════════════════════════════════════════════════════

describe('실사용: DB ↔ 인메모리 파이프라인', () => {
  const bridge = new IndexBridge(SHAPE, LABELS);

  it('DB 범위 질의 → BI 변환 → extractDim 필터 → WI 복원', () => {
    // 1. DB: role=2인 모든 주소 (calcAddressRanges)
    const ranges = calcAddressRanges(SHAPE, ['2', null, null]);
    const wiIndices: number[] = [];
    for (const [lo, hi] of ranges) {
      for (let a = lo; a <= hi; a++) wiIndices.push(a);
    }

    // 2. 인메모리 변환: WI → BI
    const biPackeds = bridge.toBitBatch(wiIndices);

    // 3. BI 필터: action=5인 것만
    const filtered = biPackeds.filter((p) => bridge.bi.extractDim(p, 1) === 5);

    // 4. 결과를 WI로 복원 → DB UPDATE용
    const resultWiIndices = bridge.toWeightedBatch(filtered);

    // 검증: 모두 role=2, action=5
    for (const wiIdx of resultWiIndices) {
      const coords = bridge.wi.decode(wiIdx);
      expect(coords[0]).toBe(2);
      expect(coords[1]).toBe(5);
    }
    expect(resultWiIndices).toHaveLength(20); // resource 20개
  });

  it('BI 인메모리 Set → WI로 변환하여 DB 저장', () => {
    // 인메모리: admin(role=1)의 모든 권한을 BI Set으로 관리
    const adminSet = new Set<number>();
    for (let a = 1; a <= 8; a++) {
      for (let r = 1; r <= 20; r++) {
        adminSet.add(bridge.bi.encode([1, a, r]));
      }
    }

    // DB 저장: BI packed → WI index로 변환
    const wiIndices = bridge.toWeightedBatch([...adminSet]);

    // 검증: 모든 WI index가 유효하고 role=1
    for (const wiIdx of wiIndices) {
      expect(wiIdx).toBeGreaterThanOrEqual(0);
      expect(wiIdx).toBeLessThan(bridge.wi.size);
      expect(bridge.wi.decode(wiIdx)[0]).toBe(1);
    }
    expect(wiIndices).toHaveLength(160); // 8 × 20
  });
});
