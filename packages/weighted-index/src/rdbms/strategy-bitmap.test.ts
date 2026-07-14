// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-bitmap

/**
 * 전략 #5 — Bitmap 연산 동형 (RDBMS bitmap heap scan ≡ maskAnd)
 *
 * RDBMS가 축별 bitmap을 유지하고 교집합으로 row를 찾는 연산은
 * weighted-index의 `buildMask` + `maskAnd` + `popcount`와 수학적으로 동일하다.
 * SQLite는 bitmap index를 네이티브로 갖지 않으므로 라이브러리 bitmask로 증명.
 *
 * 주의: 연산은 동형이지만 저장 모델이 다르다.
 *   - RDBMS bitmap: row 단위 (각 row가 비트 1개)
 *   - library bitmask: 주소 공간 전체 비트맵 (size만큼 할당)
 */

import { describe, expect, it } from 'vitest';

import { buildMask, hasBit, maskAnd, popcount } from '../math/bitmask.js';
import { calcAddressRanges } from '../math/calc.js';
import { WI, shape } from './shared.js';

describe('#5 Bitmap ↔ buildMask 동형', () => {
  it('role=2 비트맵 AND action=2 비트맵 = 두 축 교집합의 주소들', () => {
    const rolePositions: number[] = [];
    const actionPositions: number[] = [];
    for (let r = 1; r <= shape[0]; r++) {
      for (let a = 1; a <= shape[1]; a++) {
        for (let x = 1; x <= shape[2]; x++) {
          const addr = WI.encode([r, a, x]);
          if (r === 2) rolePositions.push(addr);
          if (a === 2) actionPositions.push(addr);
        }
      }
    }

    const roleMask = buildMask(WI.size, rolePositions);
    const actionMask = buildMask(WI.size, actionPositions);
    const intersect = maskAnd(roleMask, actionMask);

    // 교집합 카디널리티 = shape[2] (resource 자유도만 남음)
    expect(popcount(intersect)).toBe(shape[2]);

    // 비트 위치가 calcAddressRanges(["2", "2", null])와 일치
    const ranges = calcAddressRanges([...shape], ['2', '2', null]);
    const expected: number[] = [];
    for (const [lo, hi] of ranges) for (let n = lo; n <= hi; n++) expected.push(n);

    for (const addr of expected) expect(hasBit(intersect, addr)).toBe(true);
  });
});
