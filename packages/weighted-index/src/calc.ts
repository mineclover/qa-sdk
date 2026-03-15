/**
 * calc.ts — Standalone calculation utilities for weighted positional notation.
 *
 * Pure functions only. No class instantiation required. No DOM dependencies.
 * Safe for server, worker, and test environments.
 */

// ── CoordConstraint ───────────────────────────────────────────────────────────

/**
 * 단일 차원의 좌표 제약 조건 (1-based).
 *
 * null   — 와일드카드. 이 차원의 모든 값 허용.
 * string — 쉼표(,)로 구분된 항목의 합집합(OR). 각 항목은:
 *            "n"   — 단일 좌표
 *            "a-b" — 범위 (a 이상 b 이하)
 *
 * @example
 * null      // 와일드카드 (모든 값)
 * "3"       // coord = 3
 * "2-5"     // coord = 2, 3, 4, 5
 * "1,3"     // coord = 1 OR 3
 * "1-3,7-9" // coord = 1..3 OR 7..9
 */
export type CoordConstraint = string | null;

/**
 * Compute the weight array for a given shape.
 *
 * W[i] = Π_{j > i} shape[j]   (= 1 for the last dimension)
 *
 * Matches the weight formula used inside WeightedIndex:
 *   encode: index = Σ (x_i − 1) × W[i]
 *
 * @example
 * calcWeights([8, 4, 5, 4]) // → [80, 20, 4, 1]
 */
export function calcWeights(shape: readonly number[]): number[] {
  return shape.map((_, i) =>
    shape.slice(i + 1).reduce((product, n) => product * n, 1)
  );
}

/**
 * Compute the constant (base) contribution of a partial query.
 *
 * For each fixed dimension i (fixedCoords[i] !== null), adds (coord − 1) × W[i].
 * Free dimensions (null) contribute nothing to the base.
 *
 * Use this to pre-compute the invariant part of a range query before
 * iterating over free dimensions.
 *
 * @example
 * // Fix role=4, env=1 with weights [80,20,4,1]
 * partialQueryBase([80,20,4,1], [null, null, 4, 1]) // → 12
 */
export function partialQueryBase(
  weights:     readonly number[],
  fixedCoords: ReadonlyArray<number | null>,
): number {
  return fixedCoords.reduce<number>((acc, x, i) => {
    return acc + (x !== null ? (x - 1) * weights[i] : 0);
  }, 0);
}

/**
 * 인접하거나 겹치는 [from, to] 구간들을 병합한다 (합집합).
 *
 * @example
 * mergeRanges([[0,2],[3,5],[10,12]]) // → [[0,5],[10,12]]
 */
export function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [[...sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    if (sorted[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      result.push([...sorted[i]]);
    }
  }
  return result;
}

/**
 * 두 range 결과의 교집합을 계산한다.
 *
 * 서로 다른 조건에서 구한 address range를 AND로 결합할 때 사용한다.
 *
 * @example
 * // "role=editor" 범위와 "env=production" 범위의 공통 주소
 * intersectRanges(roleRanges, envRanges)
 */
export function intersectRanges(
  a: readonly [number, number][],
  b: readonly [number, number][],
): [number, number][] {
  const result: [number, number][] = [];
  for (const [af, at] of a) {
    for (const [bf, bt] of b) {
      const from = Math.max(af, bf);
      const to   = Math.min(at, bt);
      if (from <= to) result.push([from, to]);
    }
  }
  return mergeRanges(result);
}

/**
 * base 구간에서 exclude 구간을 제거한다 (차집합).
 * 입력은 mergeRanges로 사전 정렬·병합되어 있어야 한다.
 */
export function subtractRanges(
  base: readonly [number, number][],
  exclude: readonly [number, number][],
): [number, number][] {
  if (exclude.length === 0) return [...base] as [number, number][];
  const result: [number, number][] = [];
  for (const [bf, bt] of base) {
    let cursor = bf;
    for (const [ef, et] of exclude) {
      if (et < cursor || ef > bt) continue;
      if (cursor < ef) result.push([cursor, ef - 1]);
      cursor = et + 1;
      if (cursor > bt) break;
    }
    if (cursor <= bt) result.push([cursor, bt]);
  }
  return mergeRanges(result);
}

/**
 * [0, capacity-1] 전체 공간에서 excluded 구간의 여집합을 반환한다.
 * excluded는 mergeRanges로 사전 정렬·병합되어 있어야 한다.
 */
export function complementRanges(
  capacity: number,
  excluded: readonly [number, number][],
): [number, number][] {
  const result: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of excluded) {
    if (cursor < from) result.push([cursor, from - 1]);
    cursor = to + 1;
  }
  if (cursor < capacity) result.push([cursor, capacity - 1]);
  return result;
}

/**
 * 정렬된 range 배열에서 address가 포함되어 있는지 O(log n)으로 검사한다.
 */
export function containsAddress(
  address: number,
  ranges: readonly [number, number][],
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

/**
 * position 목록을 CoordConstraint 문자열로 변환한다.
 * @example
 * positionsToConstraint([6,7,8])    → "6-8"
 * positionsToConstraint([1,3,5])    → "1,3,5"
 * positionsToConstraint([1,2,5,6]) → "1-2,5-6"
 */
export function positionsToConstraint(positions: readonly number[]): string {
  if (positions.length === 0) return "";
  const sorted = [...positions].sort((a, b) => a - b);
  const segments: string[] = [];
  let from = sorted[0];
  let to   = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === to + 1) {
      to = sorted[i];
    } else {
      segments.push(from === to ? String(from) : `${from}-${to}`);
      from = to = sorted[i];
    }
  }
  segments.push(from === to ? String(from) : `${from}-${to}`);
  return segments.join(",");
}

/**
 * 부분 좌표 제약에서 유효한 주소 구간 목록을 계산한다.
 *
 * ── 인코딩 공식 ─────────────────────────────────────────────────────────────
 *
 *   address = Σ (coord_i − 1) × W[i],   W[i] = Π_{j>i} shape[j]
 *
 * ── 제약 처리 ────────────────────────────────────────────────────────────────
 *
 *   null                  → 와일드카드: coord 1..shape[i] 전체
 *   { from, to }          → 단일 범위 (편의 형태)
 *   [{ from, to }, ...]   → 여러 범위의 합집합 (OR)
 *
 * ── 최적화 ───────────────────────────────────────────────────────────────────
 *
 *   이후 모든 차원이 와일드카드이면 하나의 연속 블록으로 처리한다.
 *   결과는 정렬·병합된 [from, to] 목록이다.
 *
 * ── 차원 위치와 range 연속성 ──────────────────────────────────────────────────
 *
 *   외부 dim(dim 0에 가까움, 높은 weight)을 고정할수록 적은 수의 큰 구간.
 *   내부 dim(dim n에 가까움, 낮은 weight)을 고정할수록 많은 수의 작은 구간.
 *
 * @example
 * // shape = [2, 4, 8, 16]
 * calcAddressRanges([2,4,8,16], [{ from:1, to:1 }, null, null, null])
 * // → [[0, 511]]  dim 0 고정 = 1개 연속 구간
 *
 * // role = editor(3) OR admin(4)
 * calcAddressRanges([8,4,16,4], [[{ from:3, to:3 }, { from:4, to:4 }], null, null, null])
 * // → [[512, 1023]]  두 구간이 인접해 병합됨
 */
export function calcAddressRanges(
  shape: readonly number[],
  constraints: ReadonlyArray<CoordConstraint>,
): [number, number][] {
  const weights = calcWeights(shape);
  return _calcRanges(shape, constraints, weights, 0, 0);
}

/**
 * CoordConstraint 문자열을 { from, to }[] 로 파싱한다.
 *
 * "3"       → [{ from:3, to:3 }]
 * "2-5"     → [{ from:2, to:5 }]
 * "1,3"     → [{ from:1, to:1 }, { from:3, to:3 }]
 * "1-3,7-9" → [{ from:1, to:3 }, { from:7, to:9 }]
 */
export function parseConstraintSegments(
  c: CoordConstraint,
  dimSize: number,
): { from: number; to: number }[] {
  if (c === null) return [{ from: 1, to: dimSize }];
  return c.split(",").map((raw) => {
    const part = raw.trim();
    const dash = part.indexOf("-");
    let from: number;
    let to: number;
    if (dash === -1) {
      from = Number(part);
      to = from;
    } else {
      from = Number(part.slice(0, dash));
      to = Number(part.slice(dash + 1));
    }
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      throw new RangeError(
        `Invalid constraint "${part}": from and to must be valid integers (got from=${from}, to=${to})`
      );
    }
    if (from > to) {
      throw new RangeError(
        `Invalid constraint "${part}": from (${from}) must be <= to (${to})`
      );
    }
    if (from < 1 || to > dimSize) {
      throw new RangeError(
        `Constraint "${part}" out of bounds: [${from}, ${to}] must be within [1, ${dimSize}]`
      );
    }
    return { from, to };
  });
}

function _calcRanges(
  shape:       readonly number[],
  constraints: ReadonlyArray<CoordConstraint>,
  weights:     readonly number[],
  dimIndex:    number,
  baseAddr:    number,
): [number, number][] {
  if (dimIndex === shape.length) {
    return [[baseAddr, baseAddr]];
  }

  const weight   = weights[dimIndex];
  const segments = parseConstraintSegments(constraints[dimIndex], shape[dimIndex]);

  // 최적화: 이후 모든 차원이 와일드카드이면 연속 블록으로 처리
  const allRemainingWild = constraints
    .slice(dimIndex + 1)
    .every((c) => c === null);

  if (allRemainingWild) {
    const raw: [number, number][] = segments.map(({ from, to }) => [
      baseAddr + (from - 1) * weight,
      baseAddr + to * weight - 1,
    ]);
    return mergeRanges(raw);
  }

  // 각 segment, 각 coord에 대해 재귀 탐색
  const ranges: [number, number][] = [];
  for (const { from, to } of segments) {
    for (let coord = from; coord <= to; coord++) {
      const sub = _calcRanges(
        shape, constraints, weights,
        dimIndex + 1,
        baseAddr + (coord - 1) * weight,
      );
      ranges.push(...sub);
    }
  }
  return mergeRanges(ranges);
}

/**
 * Describe a partial query as a human-readable formula string.
 *
 * Fixed dimensions appear as their numeric contribution;
 * free dimensions appear as symbolic terms using the provided labels.
 *
 * Returns a string of the form "base + (label_i−1)×W_i + ..."
 * where base may be 0 (omitted from the left side if so).
 *
 * @example
 * describeRangeFormula(
 *   [80, 20, 4, 1],
 *   [null, null, 4, 1],
 *   ["resource", "action", "role", "env"]
 * )
 * // → "12 + (resource−1)×80 + (action−1)×20"
 */
export function describeRangeFormula(
  weights:     readonly number[],
  fixedCoords: ReadonlyArray<number | null>,
  labels:      readonly string[],
): string {
  const base = partialQueryBase(weights, fixedCoords);
  const freeTerms = fixedCoords
    .map((x, i) => x === null ? `(${labels[i]}−1)×${weights[i]}` : null)
    .filter((t): t is string => t !== null);

  if (freeTerms.length === 0) return String(base);
  const freeStr = freeTerms.join(" + ");
  return base === 0 ? freeStr : `${base} + ${freeStr}`;
}

// ── expandRanges ──────────────────────────────────────────────────────────────

/**
 * 정렬된 [from, to] 구간 목록을 개별 정수 배열로 전개한다.
 *
 * ── 용도 ──────────────────────────────────────────────────────────────────
 *
 * calcAddressRanges / matchRanges가 반환하는 범위를 UI 그리드 셀 목록이나
 * IN (...) 쿼리 파라미터로 변환할 때 사용한다.
 *
 * ── 주의 ──────────────────────────────────────────────────────────────────
 *
 * 반환 배열 크기는 구간의 합산 길이와 같으므로, 매우 넓은 범위에 사용하면
 * 메모리를 많이 소모한다. DB 쿼리에는 범위 그대로 BETWEEN을 쓰는 것이 유리하고,
 * 이 함수는 UI 렌더링·테스트 검증 등 전개가 필수인 경우에만 사용한다.
 *
 * @example
 * expandRanges([[0, 2], [5, 7]])  // → [0, 1, 2, 5, 6, 7]
 * expandRanges([[3, 3]])          // → [3]
 * expandRanges([])                // → []
 */
export function expandRanges(ranges: readonly [number, number][]): number[] {
  let total = 0;
  for (const [from, to] of ranges) total += to - from + 1;
  const result = new Array<number>(total);
  let idx = 0;
  for (const [from, to] of ranges) {
    for (let v = from; v <= to; v++) result[idx++] = v;
  }
  return result;
}
