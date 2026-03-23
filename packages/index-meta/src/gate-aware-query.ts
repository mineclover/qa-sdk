/**
 * gate-aware-query.ts — RelationalEngine(의미적) + GateEngine(물리적) 합성 유틸리티
 *
 * ── 설계 원칙 ──────────────────────────────────────────────────────────────────
 *
 * 두 엔진을 직접 결합하지 않는다 (추상화 수준이 다름).
 * 합성 함수가 두 결과를 조합 → 호출자가 명시적으로 사용.
 * GateEngine의 cascade는 이미 AddressStateStore에 반영되어 있으므로
 * 합성 레이어에서 별도 cascade 불필요.
 */

import {
  subtractRanges,
  mergeRanges,
  positionsToConstraint,
  calcAddressRanges,
} from "weighted-index";
import type { AddressState, DimStateSpec } from "./invalid-ranges.js";
import type { AddressStateCacheRecord } from "./invalid-range-store.js";
import type { ResolveResult, PatternRule, ConflictStrategy } from "./policy-resolver.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GateAwareResult<T> {
  value: T | T[];
  matchedRules: PatternRule<T>[];
  strategy: ConflictStrategy;
  gateBlocked: boolean;
  gateState: AddressState | null;
  /** policy allow AND gate active */
  permitted: boolean;
}

// ── gateFilterRanges ─────────────────────────────────────────────────────────

/**
 * matchRanges 결과에서 gate 차단 주소를 제거한다.
 *
 * @param ranges      주소 범위 (예: calcAddressRanges 결과)
 * @param gateRecord  AddressStateStore에서 조회한 캐시 레코드 (null이면 전체 active로 간주)
 * @param mode        필터링 모드
 *   - "encodable": inactive + reserved 범위 제거 (encode 가능한 주소만 남김)
 *   - "decodable": open + reserved 범위 제거 (decode 가능한 주소만 남김)
 *   - "active":    inactive + open + reserved 모두 제거 (완전 active만 남김)
 */
export function gateFilterRanges(
  ranges: readonly [number, number][],
  gateRecord: AddressStateCacheRecord | null,
  mode: "encodable" | "decodable" | "active",
): [number, number][] {
  if (!gateRecord) return ranges as [number, number][];

  const { reservedRanges, inactiveRanges, openRanges } = gateRecord;

  let blocked: [number, number][];
  switch (mode) {
    case "encodable":
      blocked = mergeRanges([
        ...(reservedRanges as [number, number][]),
        ...(inactiveRanges as [number, number][]),
      ]);
      break;
    case "decodable":
      blocked = mergeRanges([
        ...(reservedRanges as [number, number][]),
        ...(openRanges as [number, number][]),
      ]);
      break;
    case "active":
      blocked = mergeRanges([
        ...(reservedRanges as [number, number][]),
        ...(inactiveRanges as [number, number][]),
        ...(openRanges as [number, number][]),
      ]);
      break;
  }

  return subtractRanges(ranges as [number, number][], blocked);
}

// ── gateAwareResolve ─────────────────────────────────────────────────────────

/**
 * policy 결과 + gate 상태 → GateAwareResult.
 *
 * @param policyResult  이미 계산된 resolvePolicy 결과 (null이면 policy deny)
 * @param address       조회 대상 주소
 * @param gateRecord    AddressStateStore에서 조회한 캐시 레코드 (null이면 gate 미설정 = 전체 active)
 */
export function gateAwareResolve<T>(
  policyResult: ResolveResult<T> | null,
  address: number,
  gateRecord: AddressStateCacheRecord | null,
): GateAwareResult<T> | null {
  if (policyResult === null) {
    return null;
  }

  // gate 상태 판단
  let gateState: AddressState | null = null;
  let gateBlocked = false;

  if (gateRecord) {
    const { reservedRanges, inactiveRanges, openRanges } = gateRecord;
    gateState = classifyFromRanges(address, reservedRanges, inactiveRanges, openRanges);
    // gate 차단 = active가 아닌 모든 상태
    gateBlocked = gateState !== "active";
  }

  return {
    value: policyResult.value,
    matchedRules: policyResult.matchedRules,
    strategy: policyResult.strategy,
    gateBlocked,
    gateState,
    permitted: !gateBlocked,
  };
}

// ── buildDenialSpecs ─────────────────────────────────────────────────────────

/**
 * 규칙 거부 position → DimStateSpec[] 변환.
 *
 * policy가 거부한 좌표 position 목록을 DimStateSpec 형태로 변환하여
 * 선택적으로 gate에 반영할 수 있도록 한다.
 *
 * @param deniedPositions  거부된 1-based position 목록
 * @param dimIndex         대상 차원 인덱스
 * @param state            적용할 상태 (기본: "reserved")
 */
export function buildDenialSpecs(
  deniedPositions: readonly number[],
  dimIndex: number,
  state: Exclude<AddressState, "active"> = "reserved",
): DimStateSpec[] {
  if (deniedPositions.length === 0) return [];

  const coords = positionsToConstraint(deniedPositions as number[]);
  if (!coords) return [];

  return [{ dimIndex, state, coords }];
}

// ── internal ─────────────────────────────────────────────────────────────────

/** 주소를 구간에서 분류. invalid-ranges.ts의 classifyAddress와 동일 로직. */
function classifyFromRanges(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges: readonly [number, number][],
): AddressState {
  const inReserved = containsInRanges(address, reservedRanges);
  const inInactive = containsInRanges(address, inactiveRanges);
  const inOpen = containsInRanges(address, openRanges);

  const encodeBlocked = inReserved || inInactive;
  const decodeBlocked = inReserved || inOpen;

  if (encodeBlocked && decodeBlocked) return "reserved";
  if (encodeBlocked) return "inactive";
  if (decodeBlocked) return "open";
  return "active";
}

/** 정렬된 구간에서 주소 포함 여부 (binary search). */
function containsInRanges(
  address: number,
  ranges: readonly [number, number][],
): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const [from, to] = ranges[mid];
    if (address < from) hi = mid - 1;
    else if (address > to) lo = mid + 1;
    else return true;
  }
  return false;
}
