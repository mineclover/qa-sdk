// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * encode/decode 게이트 제어 테스트
 *
 * composite 주소(address)에 대해 encode/decode를 허용할지 결정하는 게이트 시스템을 검증한다.
 * dim별로 상태를 선언하면, composite 주소 공간에 대한 구간이 미리 계산되어 캐싱된다.
 * 이후 checkGate(address) 호출로 O(log n) 조회가 가능하다.
 *
 * ── 픽스처 설명 ──────────────────────────────────────────────────────────────
 *
 * SHAPE = [role(8), action(4), resource(16), env(4)] → capacity 2048
 *
 * role dim의 position 의미:
 *   1-4  active   — 현재 활성 값 (encode ✓ decode ✓)
 *   5    inactive — deprecated 값 (조회는 가능하지만 새로 생성 불가)
 *   6-8  open     — 아직 값이 없는 headroom 슬롯 (나중에 채울 수 있음)
 *
 * ── 커버하는 유저 시나리오 ───────────────────────────────────────────────────
 *
 * [S1] Headroom 예약: capacity를 미리 크게 잡고 일부를 open으로 표시.
 *      해당 주소는 encode 허용(미래 값 추가 가능)하지만 decode 불가(아직 값 없음).
 *      shouldVerify=true: 캐시 stale 가능성이 있으므로 실제 조회 권장.
 *
 * [S2] Deprecated 값 비활성화: 기존 데이터는 읽을 수 있어야 하지만(decode ✓)
 *      새로운 permission을 이 값으로 생성해서는 안 된다(encode ✗).
 *
 * [S3] 영역 잠금: 충돌 방지·예약 등의 이유로 특정 범위를 완전 차단.
 *      encode ✗ + decode ✗ (hard block). shouldVerify=false.
 *
 * [S4] 충돌 구간 자동 승격: inactive dim과 open dim이 겹치는 composite 주소는
 *      encode ✗(inactive) AND decode ✗(open) → reserved로 자동 승격.
 *      세 구간(reserved/inactive/open)은 항상 서로 겹치지 않음이 보장된다.
 *
 * [S5] 상태 캐싱 → runtime 게이트 조회: 계산된 구간을 AddressStateStore에 저장하고
 *      이후 모든 요청에서 O(log n)으로 게이트를 조회한다.
 *      캐시 없으면 null → 호출자가 전체 active로 처리.
 *
 * [S6] 할당 가능 범위 조회: "새 값을 어느 주소에 encode할 수 있나",
 *      "어느 주소를 decode할 수 있나", "완전히 active인 범위는 어디인가"를 구간으로 반환.
 */

import { describe, it, expect } from "vitest";
import {
  ADDRESS_GATE,
  computeStateRanges,
  checkGate,
  classifyAddress,
  encodableRanges,
  decodableRanges,
  activeRanges,
  positionsToConstraint,
} from "./invalid-ranges.js";
import { InMemoryAddressStateStore } from "./adapters/memory-invalid-range-store.js";
import type { DimStateSpec } from "./invalid-ranges.js";

const SHAPE = [8, 4, 16, 4] as const; // capacity 2048

// ── 게이트 상수 ───────────────────────────────────────────

describe("ADDRESS_GATE — 4가지 상태의 encode/decode 허용 조합", () => {
  it("active   : encode ✓ decode ✓", () => {
    expect(ADDRESS_GATE.active).toEqual({ encode: true,  decode: true  });
  });
  it("inactive : encode ✗ decode ✓", () => {
    expect(ADDRESS_GATE.inactive).toEqual({ encode: false, decode: true  });
  });
  it("open     : encode ✓ decode ✗", () => {
    expect(ADDRESS_GATE.open).toEqual({ encode: true,  decode: false });
  });
  it("reserved : encode ✗ decode ✗", () => {
    expect(ADDRESS_GATE.reserved).toEqual({ encode: false, decode: false });
  });
});

// ── positionsToConstraint ─────────────────────────────────

describe("positionsToConstraint — position 목록을 CoordConstraint 문자열로 변환", () => {
  it("[6,7,8] → '6-8'",       () => expect(positionsToConstraint([6,7,8])).toBe("6-8"));
  it("[1,3,5] → '1,3,5'",     () => expect(positionsToConstraint([1,3,5])).toBe("1,3,5"));
  it("[1,2,5,6] → '1-2,5-6'", () => expect(positionsToConstraint([1,2,5,6])).toBe("1-2,5-6"));
  it("[] → ''",               () => expect(positionsToConstraint([])).toBe(""));
});

// ── [S1][S2][S3] computeStateRanges ──────────────────────

describe("[S1][S2][S3][S4] computeStateRanges — dim 상태 명세에서 composite 주소 구간 계산", () => {
  it("명세 없으면 전체 active — 모든 구간이 빈 배열", () => {
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, []);
    expect(reservedRanges).toEqual([]);
    expect(inactiveRanges).toEqual([]);
    expect(openRanges).toEqual([]);
  });

  it("[S1] role 6-8 open → openRanges [1280,2047] — headroom 슬롯이 composite 구간으로 변환된다", () => {
    const { openRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "open", coords: "6-8" },
    ]);
    expect(openRanges).toEqual([[1280, 2047]]);
  });

  it("[S2] role 5 inactive → inactiveRanges [1024,1279] — deprecated 값이 composite 구간으로 변환된다", () => {
    const { inactiveRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "inactive", coords: "5" },
    ]);
    expect(inactiveRanges).toEqual([[1024, 1279]]); // role=5: (5-1)×256=1024, +256-1=1279
  });

  it("[S3] coords: null → dim 전체 잠금 — resource 전체가 reserved (capacity 전체)", () => {
    const { reservedRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 2, state: "reserved", coords: null },
    ]);
    const total = reservedRanges.reduce((s, [f, t]) => s + t - f + 1, 0);
    expect(total).toBe(2048); // resource가 모든 composite 주소에 참여하므로 전체가 reserved
  });

  it("[S4] inactive ∩ open → reserved 자동 승격 — 세 구간은 항상 서로 겹치지 않는다", () => {
    // role dim position 5-8이 inactive이고 action dim position 2-4가 open이면,
    // 이 두 dim이 겹치는 composite 주소는 encode ✗(inactive) AND decode ✗(open) → reserved
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, [
      { dimIndex: 0, state: "inactive", coords: "5-8" },
      { dimIndex: 1, state: "open",     coords: "2-4" },
    ]);

    const allPositions = new Set([
      ...reservedRanges.flatMap(([f,t]) => Array.from({length:t-f+1},(_,i)=>f+i)),
      ...inactiveRanges.flatMap(([f,t]) => Array.from({length:t-f+1},(_,i)=>f+i)),
      ...openRanges.flatMap(([f,t])     => Array.from({length:t-f+1},(_,i)=>f+i)),
    ]);
    const total =
      reservedRanges.reduce((s,[f,t])=>s+t-f+1,0) +
      inactiveRanges.reduce((s,[f,t])=>s+t-f+1,0) +
      openRanges.reduce((s,[f,t])=>s+t-f+1,0);
    // Set 크기 = 합계이면 중복(겹침) 없음
    expect(allPositions.size).toBe(total);
  });
});

// ── [S1][S2][S3] checkGate ────────────────────────────────

describe("[S1][S2][S3] checkGate — 주소의 encode/decode 허용 여부 조회 (O(log n))", () => {
  // role=1,2 active / role=3,4 open [S1] / role=5,6 inactive [S2] / role=7,8 reserved [S3]
  const specs: DimStateSpec[] = [
    { dimIndex: 0, state: "reserved", coords: "7-8" },
    { dimIndex: 0, state: "inactive", coords: "5-6" },
    { dimIndex: 0, state: "open",     coords: "3-4" },
  ];
  const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, specs);

  const gate = (addr: number) => checkGate(addr, reservedRanges, inactiveRanges, openRanges);
  const cls  = (addr: number) => classifyAddress(addr, reservedRanges, inactiveRanges, openRanges);

  it("role=1,2 (active): encode ✓ decode ✓ — 정상 주소, write-back 없이 사용", () => {
    const addr = 0; // role=1
    expect(cls(addr)).toBe("active");
    expect(gate(addr)).toEqual({ encode: true, decode: true, state: "active", shouldVerify: false });
  });

  it("[S1] role=3,4 (open): encode ✓ decode ✗ shouldVerify=true — headroom 슬롯, 캐시 stale 가능", () => {
    const addr = (3-1)*256; // role=3 = 512
    expect(cls(addr)).toBe("open");
    const g = gate(addr);
    expect(g.encode).toBe(true);
    expect(g.decode).toBe(false);
    expect(g.state).toBe("open");
    // 캐시 갱신 전에 값이 채워졌을 수 있으므로 실제 조회로 검증 권장
    expect(g.shouldVerify).toBe(true);
  });

  it("[S2] role=5,6 (inactive): encode ✗ decode ✓ — deprecated 값, 조회는 되지만 새로 생성 불가", () => {
    const addr = (5-1)*256; // role=5 = 1024
    expect(cls(addr)).toBe("inactive");
    expect(gate(addr)).toEqual({ encode: false, decode: true, state: "inactive", shouldVerify: false });
  });

  it("[S3] role=7,8 (reserved): encode ✗ decode ✗ shouldVerify=false — hard block, 검증 불필요", () => {
    const addr = (7-1)*256; // role=7 = 1536
    expect(cls(addr)).toBe("reserved");
    expect(gate(addr)).toEqual({ encode: false, decode: false, state: "reserved", shouldVerify: false });
  });

  it("[S1] shouldVerify는 open에서만 true — 다른 상태는 캐시 stale 가능성 없음", () => {
    const states = (["active","inactive","open","reserved"] as const);
    for (const state of states) {
      const addr = state === "active"   ? 0
                 : state === "open"     ? (3-1)*256
                 : state === "inactive" ? (5-1)*256
                 :                       (7-1)*256;
      expect(gate(addr).shouldVerify).toBe(state === "open");
    }
  });
});

// ── [S6] 구간 조회 헬퍼 ──────────────────────────────────

describe("[S6] encodableRanges / decodableRanges / activeRanges — 할당 가능 범위 조회", () => {
  // role 7-8: reserved [1536,2047]
  // role 5-6: inactive [1024,1535]
  // role 3-4: open     [512,1023]
  // role 1-2: active   [0,511]
  const specs: DimStateSpec[] = [
    { dimIndex: 0, state: "reserved", coords: "7-8" },
    { dimIndex: 0, state: "inactive", coords: "5-6" },
    { dimIndex: 0, state: "open",     coords: "3-4" },
  ];
  const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, specs);

  it("[S6] encodableRanges: 새 값을 쓸 수 있는 범위 = active(1-2) + open(3-4) = [0,1023]", () => {
    const result = encodableRanges(2048, reservedRanges, inactiveRanges);
    expect(result).toEqual([[0, 1023]]);
  });

  it("[S6] decodableRanges: 조회 가능한 범위 = active(1-2) + inactive(5-6) = [0,511] + [1024,1535]", () => {
    const result = decodableRanges(2048, reservedRanges, openRanges);
    expect(result).toEqual([[0, 511], [1024, 1535]]);
  });

  it("[S6] activeRanges: encode + decode 모두 가능한 범위 = active(1-2)만 = [0,511]", () => {
    const result = activeRanges(2048, reservedRanges, inactiveRanges, openRanges);
    expect(result).toEqual([[0, 511]]);
  });
});

// ── [S5] 상태 캐싱 → runtime 게이트 조회 ─────────────────

describe("[S5] 상태 캐싱 → runtime 게이트 조회 E2E", () => {
  it("[S1][S2][S5] 계산된 구간을 저장하고 이후 조회에서 O(log n)으로 게이트를 확인한다", async () => {
    // 시나리오: role capacity=8, 실제 사용 position 1-4, deprecated=5, headroom=6-8
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: "inactive", coords: positionsToConstraint([5]),    reason: "deprecated" },
      { dimIndex: 0, state: "open",     coords: positionsToConstraint([6,7,8]),reason: "headroom" },
    ];

    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, specs);

    const store = new InMemoryAddressStateStore();
    await store.save({ prefix: "perm", versionId: "v1", specs, reservedRanges, inactiveRanges, openRanges, computedAt: "2026-01-01T00:00:00Z" });

    const cached = await store.get("perm", "v1");
    const { reservedRanges: rv, inactiveRanges: ia, openRanges: op } = cached!;

    // role=3 (active): 정상 주소 — encode + decode 모두 허용
    const g3 = checkGate((3-1)*256, rv, ia, op);
    expect(g3).toEqual({ encode: true, decode: true, state: "active", shouldVerify: false });

    // role=5 (inactive): deprecated 값 — 기존 데이터 조회는 가능, 새 생성 차단
    const g5 = checkGate((5-1)*256, rv, ia, op);
    expect(g5).toEqual({ encode: false, decode: true, state: "inactive", shouldVerify: false });

    // role=7 (open): headroom 슬롯 — 미래 값 추가 허용, 아직 값 없어 decode 불가
    const g7 = checkGate((7-1)*256, rv, ia, op);
    expect(g7.encode).toBe(true);
    expect(g7.decode).toBe(false);
    expect(g7.state).toBe("open");
    expect(g7.shouldVerify).toBe(true); // 캐시 갱신 전 값이 채워졌을 수 있음
  });

  it("[S5] 캐시 없으면 null 반환 — 호출자가 전체 active로 처리한다", async () => {
    const store = new InMemoryAddressStateStore();
    const cached = await store.get("perm", "v99");
    expect(cached).toBeNull();
  });
});
