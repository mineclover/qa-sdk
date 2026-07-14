// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * pattern-lattice.ts — Pattern lattice operations for CoordConstraint arrays.
 *
 * CoordConstraint 배열 = "패턴". 패턴 간 포함 관계(partial order)와
 * lattice 연산(meet/join)을 정의한다.
 * 기반: subtractRanges, intersectRanges, mergeRanges (calc.ts의 range algebra).
 */

import {
  type CoordConstraint,
  mergeRanges,
  intersectRanges,
  subtractRanges,
  parseConstraintSegments,
} from './calc.js';

/**
 * Constraint를 정렬·병합된 [from, to] 범위 배열로 변환한다.
 * null → [1, dimSize] 전체 범위.
 */
function _constraintToRanges(c: CoordConstraint, dimSize: number): [number, number][] {
  return mergeRanges(
    parseConstraintSegments(c, dimSize).map(({ from, to }) => [from, to] as [number, number]),
  );
}

/**
 * 정렬·병합된 [from, to] 범위 배열을 CoordConstraint 문자열로 변환한다.
 * 전체 범위이면 null (와일드카드)을 반환한다.
 *
 * @example
 * rangesToConstraint([[1, 3], [7, 9]], 16) // → "1-3,7-9"
 * rangesToConstraint([[1, 8]], 8)           // → null (전체 범위 = 와일드카드)
 */
export function rangesToConstraint(
  ranges: readonly [number, number][],
  dimSize: number,
): CoordConstraint {
  if (ranges.length === 1 && ranges[0][0] === 1 && ranges[0][1] === dimSize) {
    return null;
  }
  return ranges.map(([from, to]) => (from === to ? String(from) : `${from}-${to}`)).join(',');
}

/**
 * 단일 차원에서 제약 a의 값 집합이 제약 b의 값 집합을 포함하는지 판정한다.
 *
 * a ⊇ b  ⟺  subtractRanges(bRanges, aRanges).length === 0
 *
 * @example
 * constraintContains(null,  "3",   8)  // → true  (와일드카드 ⊇ 모든 것)
 * constraintContains("2-5", "3",   8)  // → true
 * constraintContains("3",   "2-5", 8)  // → false
 * constraintContains("3",   null,  8)  // → false (단일 값 ⊉ 와일드카드)
 */
export function constraintContains(
  a: CoordConstraint,
  b: CoordConstraint,
  dimSize: number,
): boolean {
  if (a === null) return true;
  const aRanges = _constraintToRanges(a, dimSize);
  const bRanges = _constraintToRanges(b, dimSize);
  return subtractRanges(bRanges, aRanges).length === 0;
}

/**
 * 패턴 a의 주소 집합이 패턴 b의 주소 집합을 포함하는지 판정한다.
 * 각 차원에서 a ⊇ b이면 전체 데카르트 곱도 a ⊇ b이다.
 *
 * @example
 * const shape = [8, 4, 16];
 * patternContains(shape, [null,  null, null], ["3", "2", null])  // → true
 * patternContains(shape, ["3",  null, null],  ["3", "2", null])  // → true
 * patternContains(shape, ["3",  "2",  null],  ["3", null, null]) // → false
 */
export function patternContains(
  shape: readonly number[],
  a: ReadonlyArray<CoordConstraint>,
  b: ReadonlyArray<CoordConstraint>,
): boolean {
  for (let i = 0; i < shape.length; i++) {
    if (!constraintContains(a[i], b[i], shape[i])) return false;
  }
  return true;
}

/**
 * 두 패턴의 greatest lower bound (교집합 패턴)를 반환한다.
 * 어떤 차원에서든 교집합이 비어 있으면 null (공집합).
 *
 * @example
 * const shape = [8, 4, 16];
 * patternMeet([null, "2", null], ["3", null, null], shape)
 * // → ["3", "2", null]
 *
 * patternMeet(["1-3", null, null], ["5-8", null, null], shape)
 * // → null  (role 범위가 겹치지 않음)
 */
export function patternMeet(
  a: ReadonlyArray<CoordConstraint>,
  b: ReadonlyArray<CoordConstraint>,
  shape: readonly number[],
): CoordConstraint[] | null {
  const result: CoordConstraint[] = [];
  for (let i = 0; i < shape.length; i++) {
    const aRanges = _constraintToRanges(a[i], shape[i]);
    const bRanges = _constraintToRanges(b[i], shape[i]);
    const intersection = intersectRanges(aRanges, bRanges);
    if (intersection.length === 0) return null;
    result.push(rangesToConstraint(intersection, shape[i]));
  }
  return result;
}

/**
 * 두 패턴의 least upper bound (합집합을 포함하는 최소 패턴)를 반환한다.
 *
 * @example
 * const shape = [8, 4, 16];
 * patternJoin(["1-3", null, null], ["5-8", null, null], shape)
 * // → ["1-3,5-8", null, null]
 *
 * patternJoin(["3", "2", null], ["3", "4", null], shape)
 * // → ["3", "2,4", null]
 */
export function patternJoin(
  a: ReadonlyArray<CoordConstraint>,
  b: ReadonlyArray<CoordConstraint>,
  shape: readonly number[],
): CoordConstraint[] {
  const result: CoordConstraint[] = [];
  for (let i = 0; i < shape.length; i++) {
    const aRanges = _constraintToRanges(a[i], shape[i]);
    const bRanges = _constraintToRanges(b[i], shape[i]);
    const union = mergeRanges([...aRanges, ...bRanges]);
    result.push(rangesToConstraint(union, shape[i]));
  }
  return result;
}

/**
 * 패턴의 구체성 점수를 계산한다.
 *
 * 각 차원: 1 − (coveredValues / dimSize)
 * - 와일드카드 → 0
 * - 단일 값   → (dimSize−1) / dimSize  (≈ 1)
 *
 * 범위: [0, ndims)  (전체 와일드카드 = 0, 전체 고정 → ndims에 수렴)
 *
 * @example
 * const shape = [8, 4, 16];
 * patternSpecificity([null,  null, null], shape) // → 0
 * patternSpecificity(["3",   null, null], shape) // → 0.875
 * patternSpecificity(["3",   "2",  null], shape) // → 1.625
 * patternSpecificity(["3",   "2",  "5"],  shape) // → 2.5625
 */
export function patternSpecificity(
  pattern: ReadonlyArray<CoordConstraint>,
  shape: readonly number[],
): number {
  let score = 0;
  for (let i = 0; i < shape.length; i++) {
    if (pattern[i] === null) continue;
    const ranges = parseConstraintSegments(pattern[i], shape[i]);
    const covered = ranges.reduce((sum, { from, to }) => sum + (to - from + 1), 0);
    score += 1 - covered / shape[i];
  }
  return score;
}

/**
 * 1-based 좌표가 패턴에 포함되는지 판정한다. O(ndims).
 *
 * @example
 * const shape = [8, 4, 16];
 * coordMatchesPattern([3, 2, 5], ["3",   "2",  null], shape) // → true
 * coordMatchesPattern([3, 2, 5], ["1-2", null, null], shape) // → false
 */
export function coordMatchesPattern(
  coord: readonly number[],
  pattern: ReadonlyArray<CoordConstraint>,
  shape: readonly number[],
): boolean {
  for (let i = 0; i < shape.length; i++) {
    if (pattern[i] === null) continue;
    const ranges = parseConstraintSegments(pattern[i], shape[i]);
    const val = coord[i];
    if (!ranges.some(({ from, to }) => val >= from && val <= to)) return false;
  }
  return true;
}
