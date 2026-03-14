/**
 * invalid-ranges.ts — 1D 주소 공간의 활성화 상태 캐싱
 *
 * ── 활성화 상태 ──────────────────────────────────────────────────────────────
 *
 *   active   : 활성. 값이 있고 사용 가능. encode + decode 허용.
 *   inactive : 비활성. 값은 있으나 비활성 처리됨.
 *              기존 데이터 decode는 허용, 새 encode 불가.
 *   reserved : 예약됨. capacity 공간은 있으나 값이 없음.
 *              encode/decode 모두 불가.
 *
 * ── 합성 규칙 ────────────────────────────────────────────────────────────────
 *
 *   composite 주소의 상태 = 가장 제약이 강한 dim의 상태.
 *   reserved > inactive > active
 *
 *   어느 한 dim이라도 reserved → composite reserved
 *   어느 한 dim이라도 inactive (reserved 아님) → composite inactive
 *   모든 dim이 active → composite active
 *
 * ── 캐싱 목적 ────────────────────────────────────────────────────────────────
 *
 *   dim별 상태를 composite 주소 공간으로 미리 계산해 저장한다.
 *   이후 isActive(addr) / isAccessible(addr)를 O(log n) binary search로 처리.
 *
 * ── 여유 공간(reserved) 표현 ──────────────────────────────────────────────────
 *
 *   capacity가 선언되었으나 entry가 없는 position = reserved.
 *   positionsToConstraint(emptyPositions)로 constraint 문자열을 생성해
 *   DimStateSpec에 전달한다.
 */

import { calcAddressRanges, mergeRanges, type CoordConstraint } from "weighted-index";

// ── 활성화 상태 ───────────────────────────────────────────

export type AddressState = "active" | "inactive" | "reserved";

// ── 차원별 상태 명세 ──────────────────────────────────────

/**
 * 한 차원의 특정 coord 범위에 대한 상태 선언.
 *
 * coords: CoordConstraint 문자열. null이면 이 dim 전체에 적용.
 *
 * @example
 * // position 6-8이 비어있음 (capacity 확장 여유 공간)
 * { dimIndex: 0, state: "reserved", coords: "6-8" }
 *
 * // position 3이 비활성 처리됨
 * { dimIndex: 1, state: "inactive", coords: "3", reason: "deprecated" }
 *
 * // resource 차원 전체 비활성
 * { dimIndex: 2, state: "inactive", coords: null, reason: "차원 전환 중" }
 */
export interface DimStateSpec {
  readonly dimIndex: number;
  readonly state: Exclude<AddressState, "active">; // active는 기본값이므로 선언 불필요
  readonly coords: string | null;
  readonly reason?: string;
}

// ── 계산 함수 ─────────────────────────────────────────────

/**
 * dim별 상태 명세에서 composite 주소 구간을 계산한다.
 *
 * @returns
 *   reservedRanges : reserved state composite 주소 구간
 *   inactiveRanges : inactive state composite 주소 구간 (reserved 제외)
 *
 * 두 구간은 겹치지 않는다. reserved가 inactive보다 우선하므로,
 * 같은 주소가 두 명세에 해당하면 reserved로만 기록된다.
 */
export function computeStateRanges(
  shape: readonly number[],
  specs: readonly DimStateSpec[],
): {
  reservedRanges: [number, number][];
  inactiveRanges: [number, number][];
} {
  const reserved: [number, number][] = [];
  const inactive: [number, number][] = [];

  for (const spec of specs) {
    const coordStr = spec.coords ?? `1-${shape[spec.dimIndex]}`;
    const constraints: CoordConstraint[] = shape.map((_, i) =>
      i === spec.dimIndex ? coordStr : null
    );
    const ranges = calcAddressRanges(shape, constraints);

    if (spec.state === "reserved") reserved.push(...ranges);
    else                           inactive.push(...ranges);
  }

  const mergedReserved = mergeRanges(reserved);
  const mergedInactive = mergeRanges(inactive);

  // inactive에서 reserved 구간 제거 (reserved가 우선)
  const pureInactive = _subtractRanges(mergedInactive, mergedReserved);

  return {
    reservedRanges: mergedReserved,
    inactiveRanges: pureInactive,
  };
}

// ── 상태 판단 ─────────────────────────────────────────────

/**
 * composite 주소의 활성화 상태를 O(log n)으로 판단한다.
 *
 * reserved > inactive > active 우선순위 적용.
 */
export function classifyAddress(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
): AddressState {
  if (_inRanges(address, reservedRanges)) return "reserved";
  if (_inRanges(address, inactiveRanges)) return "inactive";
  return "active";
}

/**
 * 활성화 여부: encode + decode 모두 허용되는가?
 * active 상태만 true.
 */
export function isActive(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
): boolean {
  return classifyAddress(address, reservedRanges, inactiveRanges) === "active";
}

/**
 * 접근 가능 여부: decode가 허용되는가?
 * active + inactive = true. reserved = false.
 */
export function isAccessible(
  address: number,
  reservedRanges: readonly [number, number][],
): boolean {
  return !_inRanges(address, reservedRanges);
}

// ── 구간 조회 ─────────────────────────────────────────────

/**
 * encode + decode 모두 가능한 구간 (active 상태).
 */
export function activeRanges(
  capacity: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
): [number, number][] {
  const restricted = mergeRanges([
    ...(reservedRanges as [number, number][]),
    ...(inactiveRanges as [number, number][]),
  ]);
  return _complement(capacity, restricted);
}

/**
 * decode만 가능한 구간 (inactive 상태).
 * inactiveRanges에서 reservedRanges를 제외한 결과를 그대로 반환.
 */
export function inactiveOnlyRanges(
  inactiveRanges: readonly [number, number][],
): [number, number][] {
  return [...inactiveRanges] as [number, number][];
}

// ── positionsToConstraint ─────────────────────────────────

/**
 * position 목록 → CoordConstraint 문자열.
 *
 * @example
 * positionsToConstraint([6, 7, 8])    → "6-8"
 * positionsToConstraint([1, 3, 5])    → "1,3,5"
 * positionsToConstraint([1, 2, 5, 6]) → "1-2,5-6"
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

// ── 내부 헬퍼 ─────────────────────────────────────────────

function _inRanges(address: number, ranges: readonly [number, number][]): boolean {
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

function _complement(capacity: number, excluded: readonly [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of excluded) {
    if (cursor < from) result.push([cursor, from - 1]);
    cursor = to + 1;
  }
  if (cursor < capacity) result.push([cursor, capacity - 1]);
  return result;
}

function _subtractRanges(
  base:    readonly [number, number][],
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
