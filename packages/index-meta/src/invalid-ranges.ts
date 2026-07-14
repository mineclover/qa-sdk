// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * invalid-ranges.ts — composite 주소별 encode/decode 게이트 제어
 *
 * ── 핵심 추상화 ──────────────────────────────────────────────────────────────
 *
 * 원인은 다양하지만 결과는 단순하다:
 *   특정 주소에 대해 encode를 허용하는가, decode를 허용하는가.
 *
 * 4가지 상태 = encode × decode 두 boolean의 조합:
 *
 *   active   encode ✓  decode ✓  (정상)
 *   inactive encode ✗  decode ✓  (기존 데이터 조회만, 새 값 추가 불가)
 *   open     encode ✓  decode ✗  (빈 슬롯, 값 채울 수 있음, 값 없어서 decode 불가)
 *   reserved encode ✗  decode ✗  (완전 잠금)
 *
 * ── 합성 규칙 ────────────────────────────────────────────────────────────────
 *
 *   composite 주소의 게이트 = 각 dim 게이트의 AND.
 *   어느 dim이라도 encode를 막으면 composite도 encode 차단.
 *   어느 dim이라도 decode를 막으면 composite도 decode 차단.
 *
 *   → inactive dim + open dim 조합 → encode ✗ AND decode ✗ → reserved 상태
 *
 * ── 캐싱 목적 ────────────────────────────────────────────────────────────────
 *
 *   dim별 상태를 composite 주소 공간으로 미리 계산해 저장.
 *   이후 checkGate(address) → { encode, decode }를 O(log n)으로 반환.
 */

import {
  calcAddressRanges,
  mergeRanges,
  intersectRanges,
  subtractRanges,
  complementRanges,
  containsAddress,
  type CoordConstraint,
} from 'weighted-index';

// ── 4가지 상태 ────────────────────────────────────────────

export type AddressState = 'active' | 'inactive' | 'open' | 'reserved';

/** 각 상태의 encode/decode 허용 여부 */
export const ADDRESS_GATE: Record<AddressState, { encode: boolean; decode: boolean }> = {
  active: { encode: true, decode: true },
  inactive: { encode: false, decode: true },
  open: { encode: true, decode: false },
  reserved: { encode: false, decode: false },
} as const;

// ── 차원별 상태 명세 ──────────────────────────────────────

/**
 * 한 차원의 특정 coord 범위에 대한 상태 선언.
 * active는 기본값이므로 선언 불필요.
 *
 * @example
 * { dimIndex: 0, state: "open",     coords: "6-8" }  // 빈 슬롯 (쓰기 허용)
 * { dimIndex: 0, state: "inactive", coords: "5" }     // 비활성 값
 * { dimIndex: 2, state: "reserved", coords: null }    // 차원 전체 잠금
 */
export interface DimStateSpec {
  readonly dimIndex: number;
  readonly state: Exclude<AddressState, 'active'>;
  /** CoordConstraint 문자열. null = 이 dim 전체 */
  readonly coords: string | null;
  readonly reason?: string;
}

// ── 게이트 결과 ───────────────────────────────────────────

export interface GateResult {
  readonly encode: boolean;
  readonly decode: boolean;
  readonly state: AddressState;
  /**
   * true이면 캐시 상태가 stale할 수 있으므로 실제 값 조회로 검증을 권장한다.
   *
   * open 상태에서만 true.
   * 캐시가 갱신되기 전에 이미 값이 채워졌을 수 있으므로,
   * decode=false임에도 실제로 조회해보면 값이 있을 수 있다.
   *
   * reserved는 의도적 잠금이므로 shouldVerify=false (hard block).
   */
  readonly shouldVerify: boolean;
}

// ── 계산 함수 ─────────────────────────────────────────────

/**
 * dim별 상태 명세에서 non-active 상태의 composite 주소 구간을 계산한다.
 *
 * encode 차단 구간 = inactive + reserved
 * decode 차단 구간 = open     + reserved
 *
 * 반환된 3개 구간은 서로 겹치지 않도록 우선순위를 적용한다.
 * reserved > inactive/open (더 제약적인 상태가 우선).
 */
export function computeStateRanges(
  shape: readonly number[],
  specs: readonly DimStateSpec[],
): {
  reservedRanges: [number, number][];
  inactiveRanges: [number, number][];
  openRanges: [number, number][];
} {
  const rawReserved: [number, number][] = [];
  const rawInactive: [number, number][] = [];
  const rawOpen: [number, number][] = [];

  for (const spec of specs) {
    const coordStr = spec.coords ?? `1-${shape[spec.dimIndex]}`;
    const constraints: CoordConstraint[] = shape.map((_, i) =>
      i === spec.dimIndex ? coordStr : null,
    );
    const ranges = calcAddressRanges(shape, constraints);

    if (spec.state === 'reserved') rawReserved.push(...ranges);
    else if (spec.state === 'inactive') rawInactive.push(...ranges);
    else rawOpen.push(...ranges);
  }

  const reservedRanges = mergeRanges(rawReserved);

  // inactive + open이 겹치면 → 두 게이트 모두 차단 → reserved로 승격
  const inactiveAndOpen = intersectRanges(mergeRanges(rawInactive), mergeRanges(rawOpen));

  // 최종: reserved = 원래 reserved + (inactive ∩ open)
  const finalReserved = mergeRanges([...reservedRanges, ...inactiveAndOpen]);

  // inactive/open에서 reserved 구간 제거
  const finalInactive = subtractRanges(mergeRanges(rawInactive), finalReserved);
  const finalOpen = subtractRanges(mergeRanges(rawOpen), finalReserved);

  return {
    reservedRanges: finalReserved,
    inactiveRanges: finalInactive,
    openRanges: finalOpen,
  };
}

// ── 게이트 조회 ───────────────────────────────────────────

/**
 * 주소의 encode/decode 허용 여부를 O(log n)으로 반환한다.
 *
 * encode 차단: reserved 또는 inactive 구간
 * decode 차단: reserved 또는 open 구간
 */
export function checkGate(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges: readonly [number, number][],
): GateResult {
  const state = classifyAddress(address, reservedRanges, inactiveRanges, openRanges);
  return {
    ...ADDRESS_GATE[state],
    state,
    // open: 캐시 stale 가능 → 실제 조회로 검증 권장
    // reserved: 의도적 잠금 → 검증 불필요 (hard block)
    shouldVerify: state === 'open',
  };
}

/**
 * composite 주소의 상태를 판단한다.
 *
 * encode 차단 = reserved || inactive
 * decode 차단 = reserved || open
 */
export function classifyAddress(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges: readonly [number, number][],
): AddressState {
  const encodeBlocked =
    containsAddress(address, reservedRanges) || containsAddress(address, inactiveRanges);
  const decodeBlocked =
    containsAddress(address, reservedRanges) || containsAddress(address, openRanges);

  if (encodeBlocked && decodeBlocked) return 'reserved';
  if (encodeBlocked) return 'inactive';
  if (decodeBlocked) return 'open';
  return 'active';
}

// ── 구간 조회 헬퍼 ────────────────────────────────────────

/** encode 가능한 주소 구간 (active + open) */
export function encodableRanges(
  capacity: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
): [number, number][] {
  const blocked = mergeRanges([
    ...(reservedRanges as [number, number][]),
    ...(inactiveRanges as [number, number][]),
  ]);
  return complementRanges(capacity, blocked);
}

/** decode 가능한 주소 구간 (active + inactive) */
export function decodableRanges(
  capacity: number,
  reservedRanges: readonly [number, number][],
  openRanges: readonly [number, number][],
): [number, number][] {
  const blocked = mergeRanges([
    ...(reservedRanges as [number, number][]),
    ...(openRanges as [number, number][]),
  ]);
  return complementRanges(capacity, blocked);
}

/** encode + decode 모두 가능한 주소 구간 (active only) */
export function activeRanges(
  capacity: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges: readonly [number, number][],
): [number, number][] {
  const blocked = mergeRanges([
    ...(reservedRanges as [number, number][]),
    ...(inactiveRanges as [number, number][]),
    ...(openRanges as [number, number][]),
  ]);
  return complementRanges(capacity, blocked);
}

// ── positionsToConstraint re-export ──────────────────────

export { positionsToConstraint } from 'weighted-index';
