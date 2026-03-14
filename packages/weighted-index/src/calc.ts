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
 * 부분 좌표 제약에서 유효한 주소 구간 목록을 계산한다.
 *
 * ── 인코딩 공식 ─────────────────────────────────────────────────────────────
 *
 *   address = Σ (coord_i − 1) × W[i],   W[i] = Π_{j>i} shape[j]
 *
 * ── 제약 처리 ────────────────────────────────────────────────────────────────
 *
 *   null        → 와일드카드: coord 1..shape[i] 전체 허용
 *   { from, to } → 해당 좌표 범위만 허용 (1-based)
 *
 * ── 최적화 ───────────────────────────────────────────────────────────────────
 *
 *   이후 모든 차원이 와일드카드이면 하나의 연속 블록으로 처리한다.
 *   그렇지 않으면 재귀적으로 탐색하고 인접 구간을 병합한다.
 *
 * ── 차원 위치와 range 연속성 ──────────────────────────────────────────────────
 *
 *   외부 차원(낮은 i, 높은 weight)을 고정할수록 결과가 연속적(적은 구간).
 *   내부 차원(높은 i, 낮은 weight)을 고정할수록 결과가 분산됨(많은 구간).
 *
 *   예) shape = [8, 4, 16, 4]  (role, action, resource, env)
 *     role=3 고정    → 1개 연속 구간  [512, 767]       (256개 주소)
 *     env=1  고정    → 512개 분산 구간 [0,0],[4,4],...  (512개 주소)
 *     role=3, env=1  → 64개 구간       각 크기 1        (64개 주소)
 *
 * @param shape       차원 크기 배열 [d0, d1, ..., dn]
 * @param constraints 차원별 제약. shape과 동일한 길이.
 * @returns 정렬·병합된 [from, to] 주소 구간 목록 (0-based, inclusive)
 *
 * @example
 * // shape = [8, 4, 16, 4] (role, action, resource, env)
 * calcAddressRanges([8,4,16,4], [{ from:3, to:3 }, null, null, null])
 * // → [[512, 767]]  (role=3, 나머지 와일드카드 → 256개 연속)
 *
 * calcAddressRanges([8,4,16,4], [{ from:3, to:3 }, null, null, { from:1, to:1 }])
 * // → [[512,512],[516,516],...,[764,764]]  (64개 분산)
 */
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
function _normalizeConstraint(
  c: CoordConstraint,
  dimSize: number,
): { from: number; to: number }[] {
  if (c === null) return [{ from: 1, to: dimSize }];
  return c.split(",").map((part) => {
    const dash = part.indexOf("-");
    if (dash === -1) {
      const n = Number(part);
      return { from: n, to: n };
    }
    return { from: Number(part.slice(0, dash)), to: Number(part.slice(dash + 1)) };
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
  const segments = _normalizeConstraint(constraints[dimIndex], shape[dimIndex]);

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
