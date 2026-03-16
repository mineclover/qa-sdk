/**
 * calc-big.ts — BigInt 기반 순수 계산 함수.
 *
 * calc.ts의 BigInt 대응 버전.
 * Number.MAX_SAFE_INTEGER를 초과하는 shape product에서 사용한다.
 */

import type { CoordConstraint } from "./calc.js";
import { parseConstraintSegments } from "./calc.js";

/**
 * BigInt 기반 weight 배열 계산.
 *
 * W[i] = Π_{j > i} shape[j]
 */
export function calcWeightsBig(shape: readonly bigint[]): bigint[] {
  const d = shape.length;
  const weights: bigint[] = new Array(d);
  weights[d - 1] = 1n;
  for (let i = d - 2; i >= 0; i--) {
    weights[i] = weights[i + 1] * shape[i + 1];
  }
  return weights;
}

/**
 * BigInt 기반 주소 범위 계산.
 *
 * constraints는 Number 기반 CoordConstraint를 그대로 사용한다.
 * shape는 bigint[]이며, 반환값은 [bigint, bigint][] 구간 목록.
 */
export function calcAddressRangesBig(
  shape: readonly bigint[],
  constraints: ReadonlyArray<CoordConstraint>,
): [bigint, bigint][] {
  const weights = calcWeightsBig(shape);
  return _calcRangesBig(shape, constraints, weights, 0, 0n);
}

/**
 * BigInt 범위 병합.
 */
export function mergeRangesBig(ranges: [bigint, bigint][]): [bigint, bigint][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const result: [bigint, bigint][] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    if (sorted[i][0] <= last[1] + 1n) {
      if (sorted[i][1] > last[1]) last[1] = sorted[i][1];
    } else {
      result.push([sorted[i][0], sorted[i][1]]);
    }
  }
  return result;
}

/**
 * BigInt 범위 내 주소 포함 여부 (O(log n) binary search).
 */
export function containsAddressBig(
  address: bigint,
  ranges: readonly [bigint, bigint][],
): boolean {
  if (ranges.length === 0) return false;
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const [from, to] = ranges[mid];
    if (address < from)    hi = mid - 1;
    else if (address > to) lo = mid + 1;
    else return true;
  }
  return false;
}

function _calcRangesBig(
  shape:       readonly bigint[],
  constraints: ReadonlyArray<CoordConstraint>,
  weights:     readonly bigint[],
  dimIndex:    number,
  baseAddr:    bigint,
): [bigint, bigint][] {
  if (dimIndex === shape.length) {
    return [[baseAddr, baseAddr]];
  }

  const weight = weights[dimIndex];
  const dimSize = Number(shape[dimIndex]);
  const segments = parseConstraintSegments(constraints[dimIndex], dimSize);

  const allRemainingWild = constraints
    .slice(dimIndex + 1)
    .every((c) => c === null);

  if (allRemainingWild) {
    const raw: [bigint, bigint][] = segments.map(({ from, to }) => [
      baseAddr + BigInt(from - 1) * weight,
      baseAddr + BigInt(to) * weight - 1n,
    ]);
    return mergeRangesBig(raw);
  }

  const ranges: [bigint, bigint][] = [];
  for (const { from, to } of segments) {
    for (let coord = from; coord <= to; coord++) {
      const sub = _calcRangesBig(
        shape, constraints, weights,
        dimIndex + 1,
        baseAddr + BigInt(coord - 1) * weight,
      );
      ranges.push(...sub);
    }
  }
  return mergeRangesBig(ranges);
}
