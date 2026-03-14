/**
 * 주소 활성화 상태 캐싱 테스트
 *
 * shape = [role(8), action(4), resource(16), env(4)] = 2048
 *
 * 상태 우선순위: reserved > inactive > active
 */

import { describe, it, expect } from "vitest";
import {
  computeStateRanges,
  classifyAddress,
  isActive,
  isAccessible,
  activeRanges,
  positionsToConstraint,
} from "./invalid-ranges.js";
import { InMemoryAddressStateStore } from "./adapters/memory-invalid-range-store.js";
import type { DimStateSpec } from "./invalid-ranges.js";

const SHAPE = [8, 4, 16, 4] as const;

// ── positionsToConstraint ─────────────────────────────────

describe("positionsToConstraint", () => {
  it("[6,7,8] → '6-8'",       () => expect(positionsToConstraint([6,7,8])).toBe("6-8"));
  it("[1,3,5] → '1,3,5'",     () => expect(positionsToConstraint([1,3,5])).toBe("1,3,5"));
  it("[1,2,5,6] → '1-2,5-6'", () => expect(positionsToConstraint([1,2,5,6])).toBe("1-2,5-6"));
  it("[4] → '4'",              () => expect(positionsToConstraint([4])).toBe("4"));
  it("[] → ''",                () => expect(positionsToConstraint([])).toBe(""));
});

// ── computeStateRanges ────────────────────────────────────

describe("computeStateRanges", () => {
  it("명세 없으면 두 구간 모두 빈 배열 (전체 active)", () => {
    const { reservedRanges, inactiveRanges } = computeStateRanges(SHAPE, []);
    expect(reservedRanges).toEqual([]);
    expect(inactiveRanges).toEqual([]);
  });

  it("role 6-8 reserved (여유 공간) → composite [1280, 2047]", () => {
    const { reservedRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "reserved", coords: "6-8" },
    ]);
    // role=6 시작: (6-1)×256=1280, role=8 끝: 8×256-1=2047
    expect(reservedRanges).toEqual([[1280, 2047]]);
    expect(reservedRanges[0][1] - reservedRanges[0][0] + 1).toBe(3 * 4 * 16 * 4); // 768
  });

  it("role 5-6 inactive (비활성) → inactiveRanges에 기록", () => {
    const { reservedRanges, inactiveRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "inactive", coords: "5-6", reason: "deprecated" },
    ]);
    expect(reservedRanges).toEqual([]);
    expect(inactiveRanges).toEqual([[1024, 1535]]); // role=5,6
  });

  it("coords: null → dim 전체 상태 적용", () => {
    // resource 차원 전체 reserved
    const { reservedRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 2, state: "reserved", coords: null },
    ]);
    const total = reservedRanges.reduce((s, [f, t]) => s + t - f + 1, 0);
    expect(total).toBe(2048); // capacity 전체
  });

  it("reserved가 inactive보다 우선 — 겹치는 구간은 reserved로만", () => {
    // role 5-8: inactive 선언
    // role 7-8: reserved 선언 (더 강한 제약)
    const { reservedRanges, inactiveRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "inactive", coords: "5-8" },
      { dimIndex: 0, state: "reserved", coords: "7-8" },
    ]);
    // reserved: role=7,8 → [1536,2047]
    expect(reservedRanges).toEqual([[1536, 2047]]);
    // inactive: role=5,6 만 (7,8은 reserved로 이미 처리됨)
    expect(inactiveRanges).toEqual([[1024, 1535]]);
  });
});

// ── classifyAddress / isActive / isAccessible ─────────────

describe("상태 판단", () => {
  const reserved: [number,number][] = [[1536, 2047]]; // role=7,8
  const inactive: [number,number][] = [[1024, 1535]]; // role=5,6

  it("active 구간 — isActive true, isAccessible true", () => {
    expect(classifyAddress(0, reserved, inactive)).toBe("active");
    expect(isActive(512, reserved, inactive)).toBe(true);
    expect(isAccessible(512, reserved)).toBe(true);
  });

  it("inactive 구간 — isActive false, isAccessible true", () => {
    expect(classifyAddress(1024, reserved, inactive)).toBe("inactive");
    expect(isActive(1200, reserved, inactive)).toBe(false);
    expect(isAccessible(1200, reserved)).toBe(true); // decode 허용
  });

  it("reserved 구간 — isActive false, isAccessible false", () => {
    expect(classifyAddress(1536, reserved, inactive)).toBe("reserved");
    expect(isActive(1800, reserved, inactive)).toBe(false);
    expect(isAccessible(1800, reserved)).toBe(false); // decode 불가
  });

  it("제약 없으면 전체 active", () => {
    expect(classifyAddress(0, [], [])).toBe("active");
    expect(isActive(2047, [], [])).toBe(true);
    expect(isAccessible(2047, [])).toBe(true);
  });
});

// ── activeRanges ──────────────────────────────────────────

describe("activeRanges", () => {
  it("제약 없으면 전체가 active", () => {
    expect(activeRanges(2048, [], [])).toEqual([[0, 2047]]);
  });

  it("reserved + inactive 제외한 나머지가 active", () => {
    // reserved: [1536,2047], inactive: [1024,1535]
    // active: [0,1023]
    const result = activeRanges(2048, [[1536, 2047]], [[1024, 1535]]);
    expect(result).toEqual([[0, 1023]]);
  });

  it("전체 reserved → active 없음", () => {
    expect(activeRanges(2048, [[0, 2047]], [])).toEqual([]);
  });
});

// ── E2E: 여유 공간 + 비활성 표현 → 상태 캐싱 ───────────────

describe("E2E: 활성화 상태 캐싱 전체 흐름", () => {
  it("role: 6-8 여유 공간(reserved), 5 비활성(inactive)", async () => {
    // 현재 role 테이블: capacity=8, 입력된 entries=[1,2,3,4]
    // position 5: 비활성 처리됨
    // position 6,7,8: 아직 미입력 (여유 공간)

    const specs: DimStateSpec[] = [
      {
        dimIndex: 0,
        state: "inactive",
        coords: positionsToConstraint([5]),   // "5"
        reason: "role 5 deprecated",
      },
      {
        dimIndex: 0,
        state: "reserved",
        coords: positionsToConstraint([6, 7, 8]), // "6-8"
        reason: "capacity 확장 여유 공간",
      },
    ];

    const { reservedRanges, inactiveRanges } = computeStateRanges(SHAPE, specs);

    // 저장
    const store = new InMemoryAddressStateStore();
    await store.save({
      prefix: "perm",
      versionId: "v1",
      specs,
      reservedRanges,
      inactiveRanges,
      computedAt: "2026-01-01T00:00:00Z",
    });

    // 조회
    const cached = await store.get("perm", "v1");
    const { reservedRanges: rv, inactiveRanges: ia } = cached!;

    // role=3(active): encode + decode 모두 가능
    const activeAddr = (3 - 1) * 256; // 512
    expect(classifyAddress(activeAddr, rv, ia)).toBe("active");
    expect(isActive(activeAddr, rv, ia)).toBe(true);
    expect(isAccessible(activeAddr, rv)).toBe(true);

    // role=5(inactive): decode는 가능, encode 불가
    const inactiveAddr = (5 - 1) * 256; // 1024
    expect(classifyAddress(inactiveAddr, rv, ia)).toBe("inactive");
    expect(isActive(inactiveAddr, rv, ia)).toBe(false);
    expect(isAccessible(inactiveAddr, rv)).toBe(true); // 기존 데이터 조회 허용

    // role=7(reserved): encode/decode 모두 불가
    const reservedAddr = (7 - 1) * 256; // 1536
    expect(classifyAddress(reservedAddr, rv, ia)).toBe("reserved");
    expect(isActive(reservedAddr, rv, ia)).toBe(false);
    expect(isAccessible(reservedAddr, rv)).toBe(false); // 값 없음

    // active 구간 = role 1-4 전체
    const active = activeRanges(2048, rv, ia);
    expect(active).toEqual([[0, 1023]]); // role=1..4: [0, 1023]

    // active 구간 내 모든 주소는 isActive = true
    const [af, at] = active[0];
    expect(isActive(af, rv, ia)).toBe(true);
    expect(isActive(at, rv, ia)).toBe(true);
  });

  it("캐시 재계산 — role 5 복구 후 inactive 제거", async () => {
    const store = new InMemoryAddressStateStore();

    // 초기: role 5 inactive
    const specs1: DimStateSpec[] = [
      { dimIndex: 0, state: "inactive", coords: "5", reason: "임시 비활성" },
    ];
    const r1 = computeStateRanges(SHAPE, specs1);
    await store.save({ prefix: "perm", versionId: "v1", specs: specs1, ...r1, computedAt: "2026-01-01T00:00:00Z" });

    expect(classifyAddress(1024, r1.reservedRanges, r1.inactiveRanges)).toBe("inactive");

    // role 5 복구 → 캐시 삭제 후 재계산
    await store.delete("perm", "v1");
    const r2 = computeStateRanges(SHAPE, []); // 제약 없음
    await store.save({ prefix: "perm", versionId: "v1", specs: [], ...r2, computedAt: "2026-06-01T00:00:00Z" });

    const cached = await store.get("perm", "v1");
    expect(classifyAddress(1024, cached!.reservedRanges, cached!.inactiveRanges)).toBe("active");
  });
});
