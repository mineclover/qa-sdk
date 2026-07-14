// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * bit-mask-set-e2e.test.ts — BitMaskSet E2E 증명
 *
 * BitMaskSet이 PermissionSet과 동일한 의미론을 BitIndex 기반으로 제공하면서,
 * 차원 필터링이 추가로 가능함을 검증한다.
 *
 * ── 섹션 ──────────────────────────────────────────────────────────────────
 *
 * [BMS-1] grant/check 전수: 전체 좌표 공간에서 grant → check = true
 * [BMS-2] 차원 필터 정확성: filterByDim 결과 ≡ 직접 순회 결과
 * [BMS-3] Set 대수 정합성: union/intersect/subtract 결과 검증
 * [BMS-4] 직렬화 파이프라인: grant → Base64 → 전송 → 복원 → check
 * [BMS-5] Bridge 연동: BitMaskSet ↔ WeightedIndex 주소 공간 교차
 */

import { describe, it, expect } from 'vitest';
import { BitIndex, BitMaskSet, IndexBridge } from 'bit-index';
import { calcAddressRanges } from 'weighted-index';

const SHAPE = [5, 8, 20];
const LABELS = ['role', 'action', 'resource'];
const idx = new BitIndex(SHAPE, LABELS);

// ═════════════════════════════════════════════════════════════════════════════
//  [BMS-1] grant/check 전수
// ═════════════════════════════════════════════════════════════════════════════

describe('[BMS-1] grant/check 전수 — 전체 좌표 공간', () => {
  it('800건 전수: grant → check = true, 미부여 = false', () => {
    const set = new BitMaskSet(idx);
    const all: number[][] = [];

    // 전체 부여
    for (let r = 1; r <= 5; r++) {
      for (let a = 1; a <= 8; a++) {
        for (let res = 1; res <= 20; res++) {
          set.grant([r, a, res]);
          all.push([r, a, res]);
        }
      }
    }
    expect(set.size).toBe(800);

    // 전수 확인
    for (const coords of all) {
      expect(set.check(coords)).toBe(true);
    }

    // 하나 회수 → false
    set.revoke([3, 5, 10]);
    expect(set.check([3, 5, 10])).toBe(false);
    expect(set.size).toBe(799);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BMS-2] 차원 필터 정확성
// ═════════════════════════════════════════════════════════════════════════════

describe('[BMS-2] 차원 필터 ≡ 직접 순회 결과', () => {
  const set = new BitMaskSet(idx);
  // admin(1) 전체 + editor(2) read(1)만 + viewer(3) read(1) resource 1-5만
  for (let a = 1; a <= 8; a++) for (let r = 1; r <= 20; r++) set.grant([1, a, r]);
  for (let r = 1; r <= 20; r++) set.grant([2, 1, r]);
  for (let r = 1; r <= 5; r++) set.grant([3, 1, r]);

  it('filterByDim(role=1) ≡ 직접 순회', () => {
    const filtered = set.filterByDim(0, 1);
    const manual = [...set.entries].filter((p) => idx.extractDim(p, 0) === 1);
    expect(new Set(filtered)).toEqual(new Set(manual));
    expect(filtered).toHaveLength(160);
  });

  it('filterByLabel(action=1) ≡ 직접 순회', () => {
    const filtered = set.filterByLabel('action', 1);
    const manual = [...set.entries].filter((p) => idx.extractDimByLabel(p, 'action') === 1);
    expect(new Set(filtered)).toEqual(new Set(manual));
    // admin 20 + editor 20 + viewer 5 = 45
    expect(filtered).toHaveLength(45);
  });

  it('filterByLabels({role:3, action:1}) ≡ 직접 순회', () => {
    const filtered = set.filterByLabels({ role: 3, action: 1 });
    const manual = [...set.entries].filter(
      (p) => idx.extractDimByLabel(p, 'role') === 3 && idx.extractDimByLabel(p, 'action') === 1,
    );
    expect(new Set(filtered)).toEqual(new Set(manual));
    expect(filtered).toHaveLength(5);
  });

  it('distinctDim(role) = [1, 2, 3]', () => {
    expect(set.distinctDim(0)).toEqual([1, 2, 3]);
  });

  it('distinctByLabel(resource) 정렬 확인', () => {
    const distinct = set.distinctByLabel('resource');
    // admin은 1-20 전부, editor도 1-20, viewer는 1-5 → 합집합 1-20
    expect(distinct).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BMS-3] Set 대수 정합성
// ═════════════════════════════════════════════════════════════════════════════

describe('[BMS-3] Set 대수 정합성', () => {
  it('union(A, B).size = |A| + |B| - |A ∩ B|', () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);

    // A: role=1, action=1-4
    for (let act = 1; act <= 4; act++) for (let r = 1; r <= 20; r++) a.grant([1, act, r]);

    // B: role=1, action=3-6
    for (let act = 3; act <= 6; act++) for (let r = 1; r <= 20; r++) b.grant([1, act, r]);

    const u = a.union(b);
    const i = a.intersect(b);

    // |A| = 80, |B| = 80, |A ∩ B| = 40 (action 3,4 overlap)
    expect(a.size).toBe(80);
    expect(b.size).toBe(80);
    expect(i.size).toBe(40);
    expect(u.size).toBe(80 + 80 - 40);
  });

  it('subtract: A - B = A ∩ ¬B', () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);

    for (let act = 1; act <= 4; act++) for (let r = 1; r <= 20; r++) a.grant([1, act, r]);

    for (let act = 3; act <= 6; act++) for (let r = 1; r <= 20; r++) b.grant([1, act, r]);

    const diff = a.subtract(b);
    // A - B: action 1,2만 남음 → 40건
    expect(diff.size).toBe(40);
    for (const packed of diff.entries) {
      expect(idx.extractDimByLabel(packed, 'action')).toBeLessThanOrEqual(2);
    }
  });

  it('intersect + subtract + union = 원본 복원', () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);

    for (let act = 1; act <= 4; act++) for (let r = 1; r <= 20; r++) a.grant([1, act, r]);

    for (let act = 3; act <= 6; act++) for (let r = 1; r <= 20; r++) b.grant([1, act, r]);

    // A = (A - B) ∪ (A ∩ B)
    const restored = a.subtract(b).union(a.intersect(b));
    expect(restored.size).toBe(a.size);
    for (const packed of a.entries) {
      expect(restored.checkPacked(packed)).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BMS-4] 직렬화 파이프라인
// ═════════════════════════════════════════════════════════════════════════════

describe('[BMS-4] 직렬화 파이프라인 — grant → Base64 → 전송 → 복원 → check', () => {
  it('Base64 왕복 전수 검증', () => {
    const set = new BitMaskSet(idx);
    for (let a = 1; a <= 8; a++) {
      set.grant([1, a, 10]);
    }

    // 직렬화 (서버 → 클라이언트)
    const b64 = set.toBase64();

    // 복원 (클라이언트)
    const restored = BitMaskSet.fromBase64(idx, b64);

    expect(restored.size).toBe(set.size);
    for (const packed of set.entries) {
      expect(restored.checkPacked(packed)).toBe(true);
    }
  });

  it('bytes 왕복: 대량 (160건)', () => {
    const set = new BitMaskSet(idx);
    for (let a = 1; a <= 8; a++) for (let r = 1; r <= 20; r++) set.grant([1, a, r]);

    const bytes = set.toBytes();
    const restored = BitMaskSet.fromBytes(idx, bytes);
    expect(restored.size).toBe(160);

    // 필터 기능도 복원 후 동작
    expect(restored.filterByLabel('action', 3)).toHaveLength(20);
  });

  it('array → clone → 독립성', () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 1, 1]);
    set.grant([2, 2, 2]);

    const cloned = BitMaskSet.fromArray(idx, set.toArray());
    set.grant([3, 3, 3]);

    expect(cloned.size).toBe(2);
    expect(cloned.check([3, 3, 3])).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [BMS-5] Bridge 연동: BitMaskSet ↔ WI 주소 공간
// ═════════════════════════════════════════════════════════════════════════════

describe('[BMS-5] Bridge 연동 — BitMaskSet ↔ WeightedIndex', () => {
  const bridge = new IndexBridge(SHAPE, LABELS);

  it('BitMaskSet → WI 주소 변환 → calcAddressRanges 범위 소속 검증', () => {
    const set = new BitMaskSet(idx);
    // role=2, action=5, 모든 resource
    for (let r = 1; r <= 20; r++) {
      set.grant([2, 5, r]);
    }

    // BI packed → WI index로 변환
    const wiIndices = bridge.toWeightedBatch([...set.entries]);

    // WI 범위에 포함되는지 검증
    const ranges = calcAddressRanges(SHAPE, ['2', '5', null]);
    for (const wiIdx of wiIndices) {
      // containsAddress 대신 직접 범위 확인
      const inRange = ranges.some(([lo, hi]) => wiIdx >= lo && wiIdx <= hi);
      expect(inRange).toBe(true);
    }
  });

  it('DB 범위 → BitMaskSet 로드 → 차원 필터', () => {
    // DB: role=1인 모든 주소
    const ranges = calcAddressRanges(SHAPE, ['1', null, null]);
    const wiIndices: number[] = [];
    for (const [lo, hi] of ranges) {
      for (let a = lo; a <= hi; a++) wiIndices.push(a);
    }

    // WI → BI 변환 → BitMaskSet 로드
    const biPackeds = bridge.toBitBatch(wiIndices);
    const set = BitMaskSet.fromArray(idx, biPackeds);
    expect(set.size).toBe(160);

    // 차원 필터: action=3인 것만
    const action3 = set.filterByLabel('action', 3);
    expect(action3).toHaveLength(20);
    for (const packed of action3) {
      expect(idx.extractDimByLabel(packed, 'role')).toBe(1);
      expect(idx.extractDimByLabel(packed, 'action')).toBe(3);
    }
  });
});
