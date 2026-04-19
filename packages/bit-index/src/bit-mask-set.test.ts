// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, it, expect } from "vitest";
import { BitMaskSet, uint8ToBase64, base64ToUint8 } from "./bit-mask-set.js";
import { BitIndex } from "./bit-index.js";

const SHAPE = [5, 8, 20];
const LABELS = ["role", "action", "resource"];
const idx = new BitIndex(SHAPE, LABELS);

// ═════════════════════════════════════════════════════════════════════════════
//  Base64
// ═════════════════════════════════════════════════════════════════════════════

describe("Base64 직렬화", () => {
  it("빈 배열", () => {
    expect(uint8ToBase64(new Uint8Array([]))).toBe("");
    expect(base64ToUint8("")).toEqual(new Uint8Array([]));
  });

  it("라운드트립", () => {
    const data = new Uint8Array([0, 1, 127, 128, 255, 42, 99]);
    expect(base64ToUint8(uint8ToBase64(data))).toEqual(data);
  });

  it("패딩 처리 (1, 2, 3 바이트)", () => {
    for (const len of [1, 2, 3, 4, 5, 6]) {
      const data = new Uint8Array(Array.from({ length: len }, (_, i) => i * 37));
      expect(base64ToUint8(uint8ToBase64(data))).toEqual(data);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  grant / revoke / check
// ═════════════════════════════════════════════════════════════════════════════

describe("grant / revoke / check", () => {
  it("기본 동작", () => {
    const set = new BitMaskSet(idx);
    expect(set.check([2, 5, 12])).toBe(false);

    set.grant([2, 5, 12]);
    expect(set.check([2, 5, 12])).toBe(true);
    expect(set.size).toBe(1);

    set.revoke([2, 5, 12]);
    expect(set.check([2, 5, 12])).toBe(false);
    expect(set.size).toBe(0);
  });

  it("packed 기반 조작", () => {
    const set = new BitMaskSet(idx);
    const packed = idx.encode([3, 4, 10]);
    set.grantPacked(packed);
    expect(set.checkPacked(packed)).toBe(true);
    set.revokePacked(packed);
    expect(set.checkPacked(packed)).toBe(false);
  });

  it("clear", () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 1, 1]);
    set.grant([2, 2, 2]);
    expect(set.size).toBe(2);
    set.clear();
    expect(set.size).toBe(0);
  });

  it("중복 grant → size 불변", () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 1, 1]);
    set.grant([1, 1, 1]);
    expect(set.size).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  차원 필터
// ═════════════════════════════════════════════════════════════════════════════

describe("차원 필터", () => {
  const set = new BitMaskSet(idx);
  // admin(role=1)의 모든 권한
  for (let a = 1; a <= 8; a++) {
    for (let r = 1; r <= 20; r++) {
      set.grant([1, a, r]);
    }
  }
  // editor(role=2)의 read(action=1)만
  for (let r = 1; r <= 20; r++) {
    set.grant([2, 1, r]);
  }

  it("filterByDim: role=1 → 160건", () => {
    expect(set.filterByDim(0, 1)).toHaveLength(160);
  });

  it("filterByLabel: action=1 → admin 20 + editor 20 = 40건", () => {
    expect(set.filterByLabel("action", 1)).toHaveLength(40);
  });

  it("filterByLabels: role=1, action=5 → 20건", () => {
    expect(set.filterByLabels({ role: 1, action: 5 })).toHaveLength(20);
  });

  it("filterByLabels: role=2, action=5 → 0건 (editor에 action=5 없음)", () => {
    expect(set.filterByLabels({ role: 2, action: 5 })).toHaveLength(0);
  });

  it("distinctDim: role → [1, 2]", () => {
    expect(set.distinctDim(0)).toEqual([1, 2]);
  });

  it("distinctByLabel: action → [1,2,...,8] (admin 전체)", () => {
    expect(set.distinctByLabel("action")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("필터 결과의 모든 항목이 조건 충족", () => {
    const filtered = set.filterByLabels({ role: 1, action: 3 });
    for (const packed of filtered) {
      expect(idx.extractDimByLabel(packed, "role")).toBe(1);
      expect(idx.extractDimByLabel(packed, "action")).toBe(3);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  Set 대수
// ═════════════════════════════════════════════════════════════════════════════

describe("Set 대수", () => {
  it("union", () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);
    a.grant([1, 1, 1]);
    a.grant([1, 2, 1]);
    b.grant([1, 2, 1]);
    b.grant([2, 1, 1]);

    const u = a.union(b);
    expect(u.size).toBe(3);
    expect(u.check([1, 1, 1])).toBe(true);
    expect(u.check([1, 2, 1])).toBe(true);
    expect(u.check([2, 1, 1])).toBe(true);
  });

  it("intersect", () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);
    a.grant([1, 1, 1]);
    a.grant([1, 2, 1]);
    b.grant([1, 2, 1]);
    b.grant([2, 1, 1]);

    const i = a.intersect(b);
    expect(i.size).toBe(1);
    expect(i.check([1, 2, 1])).toBe(true);
  });

  it("subtract", () => {
    const a = new BitMaskSet(idx);
    const b = new BitMaskSet(idx);
    a.grant([1, 1, 1]);
    a.grant([1, 2, 1]);
    b.grant([1, 2, 1]);

    const s = a.subtract(b);
    expect(s.size).toBe(1);
    expect(s.check([1, 1, 1])).toBe(true);
    expect(s.check([1, 2, 1])).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  직렬화
// ═════════════════════════════════════════════════════════════════════════════

describe("직렬화", () => {
  it("toArray / fromArray 라운드트립", () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 3, 5]);
    set.grant([4, 7, 15]);
    set.grant([2, 2, 2]);

    const arr = set.toArray();
    const restored = BitMaskSet.fromArray(idx, arr);
    expect(restored.size).toBe(3);
    expect(restored.check([1, 3, 5])).toBe(true);
    expect(restored.check([4, 7, 15])).toBe(true);
    expect(restored.check([2, 2, 2])).toBe(true);
  });

  it("toBytes / fromBytes 라운드트립", () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 1, 1]);
    set.grant([5, 8, 20]);

    const bytes = set.toBytes();
    const restored = BitMaskSet.fromBytes(idx, bytes);
    expect(restored.size).toBe(2);
    expect(restored.check([1, 1, 1])).toBe(true);
    expect(restored.check([5, 8, 20])).toBe(true);
  });

  it("toBase64 / fromBase64 라운드트립", () => {
    const set = new BitMaskSet(idx);
    for (let a = 1; a <= 8; a++) {
      set.grant([1, a, 1]);
    }

    const b64 = set.toBase64();
    expect(typeof b64).toBe("string");

    const restored = BitMaskSet.fromBase64(idx, b64);
    expect(restored.size).toBe(8);
    for (let a = 1; a <= 8; a++) {
      expect(restored.check([1, a, 1])).toBe(true);
    }
  });

  it("clone", () => {
    const set = new BitMaskSet(idx);
    set.grant([1, 1, 1]);
    const cloned = set.clone();

    set.grant([2, 2, 2]);
    expect(cloned.size).toBe(1); // 원본 변경이 클론에 영향 없음
    expect(cloned.check([2, 2, 2])).toBe(false);
  });
});
