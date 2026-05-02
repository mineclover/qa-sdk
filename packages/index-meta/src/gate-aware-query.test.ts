// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * gate-aware-query.test.ts — Gate-Aware Query 합성 유틸리티 테스트
 *
 * [GA-1] gateFilterRanges encodable: inactive 범위 제거
 * [GA-2] gateFilterRanges decodable: open 범위 제거
 * [GA-3] gateFilterRanges active: inactive + open 모두 제거
 * [GA-4] gateAwareResolve: policy allow + gate active → permitted:true
 * [GA-5] gateAwareResolve: policy allow + gate inactive → permitted:false, gateBlocked:true
 * [GA-6] gateAwareResolve: policy deny (null) → null
 * [GA-7] gateAwareResolve: gateRecord null (미설정) → policy 결과만 사용
 * [GA-8] buildDenialSpecs: position 목록 → DimStateSpec[] 변환
 */

import { describe, it, expect } from "vitest";
import { computeStateRanges } from "./invalid-ranges.js";
import type { AddressStateCacheRecord } from "./invalid-range-store.js";
import type { DimStateSpec } from "./invalid-ranges.js";
import type { ResolveResult } from "./policy-resolver.js";
import {
  gateFilterRanges,
  gateAwareResolve,
  buildDenialSpecs,
} from "./gate-aware-query.js";

// ── 공통 픽스처 ──────────────────────────────────────────────

// shape [8, 4] → capacity 32
// role dim: 1-4 active, 5-6 inactive, 7-8 open
const SHAPE = [8, 4] as const;
const specs: DimStateSpec[] = [
  { dimIndex: 0, state: "inactive", coords: "5-6" },
  { dimIndex: 0, state: "open", coords: "7-8" },
];
const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(
  SHAPE as unknown as number[],
  specs,
);

function makeGateRecord(
  overrides?: Partial<AddressStateCacheRecord>,
): AddressStateCacheRecord {
  return {
    prefix: "test",
    versionId: "v1",
    specs,
    reservedRanges,
    inactiveRanges,
    openRanges,
    computedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── gateFilterRanges ─────────────────────────────────────────

describe("gateFilterRanges", () => {
  const gateRecord = makeGateRecord();

  // 전체 범위 [0, 31]
  const fullRange: [number, number][] = [[0, 31]];

  it("[GA-1] encodable: inactive 범위 제거 — active + open만 남음", () => {
    const result = gateFilterRanges(fullRange, gateRecord, "encodable");
    // active: role 1-4 = [0,15], open: role 7-8 = [24,31]
    // inactive: role 5-6 = [16,23] → 제거
    expect(result).toEqual([[0, 15], [24, 31]]);
  });

  it("[GA-2] decodable: open 범위 제거 — active + inactive만 남음", () => {
    const result = gateFilterRanges(fullRange, gateRecord, "decodable");
    // active: role 1-4 = [0,15], inactive: role 5-6 = [16,23]
    // open: role 7-8 = [24,31] → 제거
    expect(result).toEqual([[0, 23]]);
  });

  it("[GA-3] active: inactive + open 모두 제거 — active만 남음", () => {
    const result = gateFilterRanges(fullRange, gateRecord, "active");
    // active: role 1-4 = [0,15]
    expect(result).toEqual([[0, 15]]);
  });

  it("gateRecord null → 원래 범위 그대로 반환", () => {
    const result = gateFilterRanges(fullRange, null, "active");
    expect(result).toEqual(fullRange);
  });
});

// ── gateAwareResolve ─────────────────────────────────────────

describe("gateAwareResolve", () => {
  const gateRecord = makeGateRecord();

  const policyAllow: ResolveResult<string> = {
    value: "allow",
    matchedRules: [{ id: "r1", pattern: [null], value: "allow" }],
    strategy: "most-specific",
  };

  it("[GA-4] policy allow + gate active → permitted:true", () => {
    const addr = 0; // role=1 → active
    const result = gateAwareResolve(policyAllow, addr, gateRecord);
    expect(result).not.toBeNull();
    expect(result!.permitted).toBe(true);
    expect(result!.gateBlocked).toBe(false);
    expect(result!.gateState).toBe("active");
    expect(result!.value).toBe("allow");
  });

  it("[GA-5] policy allow + gate inactive → permitted:false, gateBlocked:true", () => {
    const addr = 16; // role=5 → inactive (5-1)*4 = 16
    const result = gateAwareResolve(policyAllow, addr, gateRecord);
    expect(result).not.toBeNull();
    expect(result!.permitted).toBe(false);
    expect(result!.gateBlocked).toBe(true);
    expect(result!.gateState).toBe("inactive");
  });

  it("[GA-6] policy deny (null) → null", () => {
    const result = gateAwareResolve(null, 0, gateRecord);
    expect(result).toBeNull();
  });

  it("[GA-7] gateRecord null (미설정) → policy 결과만 사용, gateState null", () => {
    const addr = 0;
    const result = gateAwareResolve(policyAllow, addr, null);
    expect(result).not.toBeNull();
    expect(result!.permitted).toBe(true);
    expect(result!.gateBlocked).toBe(false);
    expect(result!.gateState).toBeNull();
    expect(result!.value).toBe("allow");
  });

  it("policy allow + gate open → permitted:false, gateBlocked:true", () => {
    const addr = 24; // role=7 → open (7-1)*4 = 24
    const result = gateAwareResolve(policyAllow, addr, gateRecord);
    expect(result!.permitted).toBe(false);
    expect(result!.gateBlocked).toBe(true);
    expect(result!.gateState).toBe("open");
  });
});

// ── buildDenialSpecs ─────────────────────────────────────────

describe("buildDenialSpecs", () => {
  it("[GA-8] position 목록 → DimStateSpec[] 변환 (기본 reserved)", () => {
    const result = buildDenialSpecs([3, 5, 6], 0);
    expect(result).toEqual([
      { dimIndex: 0, state: "reserved", coords: "3,5-6" },
    ]);
  });

  it("빈 position 목록 → 빈 배열", () => {
    const result = buildDenialSpecs([], 0);
    expect(result).toEqual([]);
  });

  it("custom state (inactive) 적용", () => {
    const result = buildDenialSpecs([1, 2], 1, "inactive");
    expect(result).toEqual([
      { dimIndex: 1, state: "inactive", coords: "1-2" },
    ]);
  });
});
