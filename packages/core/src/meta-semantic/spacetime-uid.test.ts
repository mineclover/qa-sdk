// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import {
  buildSegments,
  totalAddressSpace,
  encodePathAddress,
  decodePathAddress,
  createSpacetimeUID,
  parseSpacetimeUID,
  pathAddressRange,
  addressesForBranch,
  type PathBranchPoint,
} from "./spacetime-uid.js";

// 스펙 예시: processOrder 함수
const orderType: PathBranchPoint = { id: "orderType", branchCount: 3 };
const paymentMethod: PathBranchPoint = { id: "paymentMethod", branchCount: 4 };
const shippingOption: PathBranchPoint = { id: "shippingOption", branchCount: 2 };

const segments = buildSegments([
  { pathId: "processOrder:type→payment", branchChain: [orderType, paymentMethod] },
  { pathId: "processOrder:type→shipping", branchChain: [orderType, shippingOption] },
]);

describe("buildSegments", () => {
  it("오프셋이 연접 순서로 계산됨", () => {
    expect(segments[0].addressOffset).toBe(0);
    expect(segments[0].size).toBe(12); // 3 × 4
    expect(segments[1].addressOffset).toBe(12);
    expect(segments[1].size).toBe(6); // 3 × 2
  });
});

describe("totalAddressSpace", () => {
  it("전체 주소 공간 = 경로 합산", () => {
    expect(totalAddressSpace(segments)).toBe(18); // 12 + 6
  });

  it("빈 세그먼트 → 0", () => {
    expect(totalAddressSpace([])).toBe(0);
  });
});

describe("encodePathAddress / decodePathAddress", () => {
  it("라운드트립: encode → decode 복원", () => {
    const coord = [1, 2]; // orderType=1(normal), paymentMethod=2(bank)
    const addr = encodePathAddress(segments[0], coord);
    const decoded = decodePathAddress(segments, addr);
    expect(decoded.segment.pathId).toBe("processOrder:type→payment");
    expect(decoded.coord).toEqual(coord);
  });

  it("두 번째 세그먼트도 정확히 복원", () => {
    const coord = [2, 1]; // orderType=2(express), shippingOption=1(express)
    const addr = encodePathAddress(segments[1], coord);
    expect(addr).toBeGreaterThanOrEqual(12);
    const decoded = decodePathAddress(segments, addr);
    expect(decoded.segment.pathId).toBe("processOrder:type→shipping");
    expect(decoded.coord).toEqual(coord);
  });

  it("전체 주소 공간 순회 — 모든 주소가 유일하고 복원 가능", () => {
    const total = totalAddressSpace(segments);
    const seen = new Set<number>();
    for (const seg of segments) {
      for (let local = 0; local < seg.size; local++) {
        const addr = seg.addressOffset + local;
        expect(seen.has(addr)).toBe(false);
        seen.add(addr);
        const decoded = decodePathAddress(segments, addr);
        expect(decoded.segment.pathId).toBe(seg.pathId);
      }
    }
    expect(seen.size).toBe(total);
  });

  it("범위 초과 → 에러", () => {
    expect(() => decodePathAddress(segments, 18)).toThrow("범위 초과");
  });

  it("차원 불일치 → 에러", () => {
    expect(() => encodePathAddress(segments[0], [1])).toThrow("차원");
  });
});

describe("createSpacetimeUID / parseSpacetimeUID", () => {
  it("생성 + 파싱 라운드트립", () => {
    const uid = createSpacetimeUID(1, 0, 42);
    expect(uid).toBe("intent:v1:1:0:42");
    const parsed = parseSpacetimeUID(uid);
    expect(parsed).toEqual({ functionIndex: 1, pathAddress: 0, txSeq: 42 });
  });

  it("유효하지 않은 UID → 에러", () => {
    expect(() => parseSpacetimeUID("invalid")).toThrow("유효하지 않은");
    expect(() => parseSpacetimeUID("intent:v2:1:0:42")).toThrow("유효하지 않은");
  });
});

describe("pathAddressRange", () => {
  it("세그먼트 주소 범위 반환", () => {
    expect(pathAddressRange(segments[0])).toEqual({ start: 0, end: 11 });
    expect(pathAddressRange(segments[1])).toEqual({ start: 12, end: 17 });
  });
});

describe("addressesForBranch", () => {
  it("특정 분기값에 해당하는 모든 주소 수집", () => {
    // orderType=2(express)의 모든 경로
    const addrs = addressesForBranch(segments, "orderType", 2);
    // seg[0]: orderType=2 → paymentMethod 4종 = 주소 [8,9,10,11]
    // seg[1]: orderType=2 → shippingOption 2종 = 주소 [16,17]
    expect(addrs).toHaveLength(6);
    expect(addrs).toContain(8);
    expect(addrs).toContain(11);
    expect(addrs).toContain(16);
    expect(addrs).toContain(17);
  });

  it("존재하지 않는 분기 → 빈 배열", () => {
    expect(addressesForBranch(segments, "nonexistent", 0)).toHaveLength(0);
  });
});

// ── 엣지 케이스 ───────────────────────────────────────

describe("엣지 케이스", () => {
  it("단일 분기점 (branchCount=1) → 주소 1개", () => {
    const segs = buildSegments([
      { pathId: "single", branchChain: [{ id: "only", branchCount: 1 }] },
    ]);
    expect(segs[0].size).toBe(1);
    expect(totalAddressSpace(segs)).toBe(1);
    expect(encodePathAddress(segs[0], [0])).toBe(0);
    expect(decodePathAddress(segs, 0).coord).toEqual([0]);
  });

  it("대규모 세그먼트 (100개 경로) — 주소 공간 무결성", () => {
    const paths = Array.from({ length: 100 }, (_, i) => ({
      pathId: `path-${i}`,
      branchChain: [{ id: `bp-${i}`, branchCount: 3 }],
    }));
    const segs = buildSegments(paths);
    expect(totalAddressSpace(segs)).toBe(300); // 100 × 3

    // 마지막 세그먼트의 마지막 주소 복원
    const lastAddr = totalAddressSpace(segs) - 1;
    const decoded = decodePathAddress(segs, lastAddr);
    expect(decoded.segment.pathId).toBe("path-99");
    expect(decoded.coord).toEqual([2]);
  });

  it("다차원 분기 (3D) → 라운드트립", () => {
    const segs = buildSegments([{
      pathId: "3d",
      branchChain: [
        { id: "a", branchCount: 2 },
        { id: "b", branchCount: 3 },
        { id: "c", branchCount: 4 },
      ],
    }]);
    expect(segs[0].size).toBe(24); // 2×3×4
    const coord = [1, 2, 3];
    const addr = encodePathAddress(segs[0], coord);
    expect(decodePathAddress(segs, addr).coord).toEqual(coord);
  });

  it("UID에 큰 숫자 → 정확한 파싱", () => {
    const uid = createSpacetimeUID(999, 123456, 999999);
    const parsed = parseSpacetimeUID(uid);
    expect(parsed.functionIndex).toBe(999);
    expect(parsed.pathAddress).toBe(123456);
    expect(parsed.txSeq).toBe(999999);
  });
});
