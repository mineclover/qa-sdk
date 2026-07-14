// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * encoding-bridge.test.ts — IndexBridge E2E 증명
 *
 * WeightedIndex ↔ BitIndex 간 좌표 기반 상호 변환이
 * 전체 주소 공간에서 무손실 왕복을 보장하는지 검증한다.
 *
 * ── 변환 파이프라인 ───────────────────────────────────────────────────────
 *
 *   DB (WeightedIndex)                     인메모리 (BitIndex)
 *   ┌─────────────┐                        ┌─────────────┐
 *   │ WI index    │ ─── toBit() ─────────→ │ BI packed   │
 *   │ (1D 정수)   │                        │ (비트 필드)  │
 *   │             │ ←── toWeighted() ───── │             │
 *   └─────────────┘                        └─────────────┘
 *         │                                       │
 *    calcAddressRanges                     extractDim O(1)
 *    DB BETWEEN 질의                       캐시 키 / 필터
 *
 * ── 섹션 ──────────────────────────────────────────────────────────────────
 *
 * [BR-1] 전수 왕복: 전체 주소 공간에서 toBit → toWeighted = identity
 * [BR-2] 좌표 보존: 어느 경로든 같은 좌표 복원
 * [BR-3] 파이프라인: DB 범위 질의 → BI 필터 → DB 복원
 * [BR-4] 파이프라인: BI 인메모리 → DB 저장 → DB 범위 검증
 * [BR-5] 대규모 shape: 랜덤 샘플링 왕복
 */

import { describe, it, expect } from 'vitest';
import { IndexBridge } from 'bit-index';
import { calcAddressRanges, containsAddress } from 'weighted-index';

// ═════════════════════════════════════════════════════════════════════════════
//  [BR-1] 전수 왕복
// ═════════════════════════════════════════════════════════════════════════════

describe('[BR-1] 전수 왕복 — toBit → toWeighted = identity', () => {
  it('shape [3,4,2] (24건): WI → BI → WI 전수 identity', () => {
    const bridge = new IndexBridge([3, 4, 2], ['a', 'b', 'c']);
    for (let i = 0; i < bridge.wi.size; i++) {
      expect(bridge.toWeighted(bridge.toBit(i))).toBe(i);
    }
  });

  it('shape [3,4,2] (24건): BI → WI → BI 전수 identity', () => {
    const bridge = new IndexBridge([3, 4, 2], ['a', 'b', 'c']);
    for (let a = 1; a <= 3; a++) {
      for (let b = 1; b <= 4; b++) {
        for (let c = 1; c <= 2; c++) {
          const biPacked = bridge.bi.encode([a, b, c]);
          expect(bridge.toBit(bridge.toWeighted(biPacked))).toBe(biPacked);
        }
      }
    }
  });

  it('shape [5,8,20] (800건): 양방향 전수 identity', () => {
    const bridge = new IndexBridge([5, 8, 20], ['role', 'action', 'resource']);
    for (let i = 0; i < bridge.wi.size; i++) {
      const biPacked = bridge.toBit(i);
      expect(bridge.toWeighted(biPacked)).toBe(i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BR-2] 좌표 보존
// ═════════════════════════════════════════════════════════════════════════════

describe('[BR-2] 좌표 보존 — 어느 경로든 같은 좌표', () => {
  const bridge = new IndexBridge([5, 8, 20], ['role', 'action', 'resource']);

  it('WI decode === BI decode(toBit(wiIndex))', () => {
    for (let i = 0; i < bridge.wi.size; i++) {
      const wiCoords = bridge.wi.decode(i);
      const biCoords = bridge.bi.decode(bridge.toBit(i));
      expect(biCoords).toEqual(wiCoords);
    }
  });

  it('BI extractDim(toBit(wiIndex)) === WI decode[dim]', () => {
    const samples = [0, 1, 42, 399, 799];
    for (const wiIndex of samples) {
      const biPacked = bridge.toBit(wiIndex);
      const wiCoords = bridge.wi.decode(wiIndex);
      for (let d = 0; d < 3; d++) {
        expect(bridge.bi.extractDim(biPacked, d)).toBe(wiCoords[d]);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BR-3] 파이프라인: DB 범위 질의 → BI 필터 → DB 복원
// ═════════════════════════════════════════════════════════════════════════════

describe('[BR-3] DB → BI 필터 → DB 파이프라인', () => {
  const shape = [5, 8, 20];
  const bridge = new IndexBridge(shape, ['role', 'action', 'resource']);

  it('role=2 질의 → action=5 필터 → DB 주소 복원', () => {
    // Step 1: DB 범위 질의 (WeightedIndex)
    const ranges = calcAddressRanges(shape, ['2', null, null]);
    const dbResults: number[] = [];
    for (const [lo, hi] of ranges) {
      for (let a = lo; a <= hi; a++) dbResults.push(a);
    }
    expect(dbResults).toHaveLength(160); // 8 × 20

    // Step 2: BI로 변환 + extractDim 필터
    const biPackeds = bridge.toBitBatch(dbResults);
    const filtered = biPackeds.filter((p) => bridge.bi.extractDim(p, 1) === 5);
    expect(filtered).toHaveLength(20); // resource 20개

    // Step 3: DB 주소로 복원
    const finalWiIndices = bridge.toWeightedBatch(filtered);

    // Step 4: 검증 — 복원된 주소가 원래 범위에 포함되고, role=2, action=5
    for (const wiIdx of finalWiIndices) {
      expect(containsAddress(wiIdx, ranges)).toBe(true);
      const coords = bridge.wi.decode(wiIdx);
      expect(coords[0]).toBe(2);
      expect(coords[1]).toBe(5);
    }
  });

  it('복합 조건: role=1-3, action=2,7 → resource=10-15 필터', () => {
    // Step 1: DB 범위 질의
    const ranges = calcAddressRanges(shape, ['1-3', '2,7', null]);
    const dbResults: number[] = [];
    for (const [lo, hi] of ranges) {
      for (let a = lo; a <= hi; a++) dbResults.push(a);
    }

    // Step 2: BI 변환 + 필터
    const biPackeds = bridge.toBitBatch(dbResults);
    const filtered = biPackeds.filter((p) => {
      const res = bridge.bi.extractDim(p, 2);
      return res >= 10 && res <= 15;
    });

    // Step 3: 복원 + 검증
    const restored = bridge.toWeightedBatch(filtered);
    for (const wiIdx of restored) {
      const [role, action, resource] = bridge.wi.decode(wiIdx);
      expect(role).toBeGreaterThanOrEqual(1);
      expect(role).toBeLessThanOrEqual(3);
      expect([2, 7]).toContain(action);
      expect(resource).toBeGreaterThanOrEqual(10);
      expect(resource).toBeLessThanOrEqual(15);
    }
    // 3 roles × 2 actions × 6 resources = 36
    expect(restored).toHaveLength(36);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BR-4] 파이프라인: BI 인메모리 → DB 저장 → DB 범위 검증
// ═════════════════════════════════════════════════════════════════════════════

describe('[BR-4] BI 인메모리 → DB 저장 → 범위 검증', () => {
  const shape = [5, 8, 20];
  const bridge = new IndexBridge(shape, ['role', 'action', 'resource']);

  it('BI Set 구축 → WI 변환 → calcAddressRanges로 검증', () => {
    // 인메모리: admin(role=1)의 read(action=1) 권한만
    const permSet = new Set<number>();
    for (let r = 1; r <= 20; r++) {
      permSet.add(bridge.bi.encode([1, 1, r]));
    }

    // DB 저장용 WI 주소로 변환
    const wiIndices = bridge.toWeightedBatch([...permSet]);

    // DB 범위로 검증: role=1, action=1 범위에 모두 포함되어야 함
    const expectedRanges = calcAddressRanges(shape, ['1', '1', null]);
    for (const wiIdx of wiIndices) {
      expect(containsAddress(wiIdx, expectedRanges)).toBe(true);
    }

    // 범위 밖(role=2) 주소는 포함되지 않음
    const role2Ranges = calcAddressRanges(shape, ['2', null, null]);
    for (const wiIdx of wiIndices) {
      expect(containsAddress(wiIdx, role2Ranges)).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BR-5] 대규모 shape 랜덤 샘플링
// ═════════════════════════════════════════════════════════════════════════════

describe('[BR-5] 대규모 shape — 랜덤 샘플링 왕복', () => {
  it('shape [100, 200, 50, 80] — 500건 왕복', () => {
    const shape = [100, 200, 50, 80];
    const bridge = new IndexBridge(shape);

    for (let i = 0; i < 500; i++) {
      const coords = shape.map((s) => Math.floor(Math.random() * s) + 1);
      const wiIndex = bridge.wi.encode(coords);
      const biPacked = bridge.toBit(wiIndex);

      // WI → BI → WI 왕복
      expect(bridge.toWeighted(biPacked)).toBe(wiIndex);

      // BI extractDim으로 좌표 확인
      for (let d = 0; d < shape.length; d++) {
        expect(bridge.bi.extractDim(biPacked, d)).toBe(coords[d]);
      }
    }
  });

  it('shape [10, 50, 8, 20, 4, 3] — 6차원 500건 왕복', () => {
    const shape = [10, 50, 8, 20, 4, 3];
    const bridge = new IndexBridge(shape);

    for (let i = 0; i < 500; i++) {
      const coords = shape.map((s) => Math.floor(Math.random() * s) + 1);
      const wiIndex = bridge.wi.encode(coords);

      expect(bridge.toWeighted(bridge.toBit(wiIndex))).toBe(wiIndex);
    }
  });
});
