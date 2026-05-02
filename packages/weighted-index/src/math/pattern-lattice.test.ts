// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import {
  rangesToConstraint,
  constraintContains,
  patternContains,
  patternMeet,
  patternJoin,
  patternSpecificity,
  coordMatchesPattern,
} from "./pattern-lattice.js";

// shape = [8, 4, 16]  (role × action × resource)
const SHAPE = [8, 4, 16] as const;

// ── rangesToConstraint ────────────────────────────────────────────────────────

describe("rangesToConstraint", () => {
  it("전체 범위 → null (와일드카드)", () => {
    expect(rangesToConstraint([[1, 8]], 8)).toBeNull();
  });

  it("단일 값", () => {
    expect(rangesToConstraint([[3, 3]], 8)).toBe("3");
  });

  it("연속 범위", () => {
    expect(rangesToConstraint([[2, 5]], 8)).toBe("2-5");
  });

  it("비연속 범위", () => {
    expect(rangesToConstraint([[1, 3], [7, 9]], 16)).toBe("1-3,7-9");
  });

  it("혼합", () => {
    expect(rangesToConstraint([[1, 1], [3, 5], [8, 8]], 16)).toBe("1,3-5,8");
  });
});

// ── constraintContains ───────────────────────────────────────────────────────

describe("constraintContains", () => {
  it("와일드카드 ⊇ 모든 것", () => {
    expect(constraintContains(null, "3", 8)).toBe(true);
    expect(constraintContains(null, "1-8", 8)).toBe(true);
    expect(constraintContains(null, null, 8)).toBe(true);
  });

  it("비-와일드카드 ⊉ 와일드카드", () => {
    expect(constraintContains("3", null, 8)).toBe(false);
    expect(constraintContains("1-7", null, 8)).toBe(false);
  });

  it("전체 범위 문자열도 와일드카드와 동일", () => {
    expect(constraintContains("1-8", null, 8)).toBe(true);
  });

  it("범위 ⊇ 단일 값", () => {
    expect(constraintContains("2-5", "3", 8)).toBe(true);
    expect(constraintContains("2-5", "2", 8)).toBe(true);
    expect(constraintContains("2-5", "5", 8)).toBe(true);
  });

  it("범위 ⊉ 범위 밖 값", () => {
    expect(constraintContains("2-5", "1", 8)).toBe(false);
    expect(constraintContains("2-5", "6", 8)).toBe(false);
  });

  it("단일 값 ⊇ 자신", () => {
    expect(constraintContains("3", "3", 8)).toBe(true);
  });

  it("단일 값 ⊉ 다른 값", () => {
    expect(constraintContains("3", "4", 8)).toBe(false);
  });

  it("비연속 OR 포함 관계", () => {
    expect(constraintContains("1,3,5", "3", 8)).toBe(true);
    expect(constraintContains("1,3,5", "1,5", 8)).toBe(true);
    expect(constraintContains("1,3,5", "2", 8)).toBe(false);
    expect(constraintContains("1,3,5", "1,2", 8)).toBe(false);
  });

  it("범위 OR 포함 관계", () => {
    expect(constraintContains("1-3,5-7", "2-6", 8)).toBe(false);
    expect(constraintContains("1-3,5-7", "1-3", 8)).toBe(true);
    expect(constraintContains("1-3,5-7", "6", 8)).toBe(true);
  });
});

// ── patternContains ──────────────────────────────────────────────────────────

describe("patternContains", () => {
  it("전체 와일드카드 ⊇ 모든 패턴", () => {
    expect(patternContains(SHAPE, [null, null, null], ["3", "2", "5"])).toBe(true);
  });

  it("부분 고정 ⊇ 더 구체적인 패턴", () => {
    expect(patternContains(SHAPE, ["3", null, null], ["3", "2", null])).toBe(true);
    expect(patternContains(SHAPE, ["3", null, null], ["3", "2", "5"])).toBe(true);
  });

  it("더 구체적인 패턴 ⊉ 덜 구체적인 패턴", () => {
    expect(patternContains(SHAPE, ["3", "2", null], ["3", null, null])).toBe(false);
  });

  it("다른 차원 값은 포함하지 않음", () => {
    expect(patternContains(SHAPE, ["3", null, null], ["4", null, null])).toBe(false);
  });

  it("자기 자신 포함", () => {
    expect(patternContains(SHAPE, ["3", "2", null], ["3", "2", null])).toBe(true);
  });

  it("범위 포함", () => {
    expect(patternContains(SHAPE, ["1-5", null, null], ["3", null, null])).toBe(true);
    expect(patternContains(SHAPE, ["1-5", null, null], ["6", null, null])).toBe(false);
  });
});

// ── patternMeet ──────────────────────────────────────────────────────────────

describe("patternMeet", () => {
  it("와일드카드 ∩ 고정 = 고정", () => {
    expect(patternMeet([null, "2", null], ["3", null, null], SHAPE))
      .toEqual(["3", "2", null]);
  });

  it("겹치는 범위", () => {
    expect(patternMeet(["1-5", null, null], ["3-8", null, null], SHAPE))
      .toEqual(["3-5", null, null]);
  });

  it("겹치지 않는 범위 → null", () => {
    expect(patternMeet(["1-3", null, null], ["5-8", null, null], SHAPE))
      .toBeNull();
  });

  it("동일 패턴 → 자기 자신", () => {
    expect(patternMeet(["3", "2", null], ["3", "2", null], SHAPE))
      .toEqual(["3", "2", null]);
  });

  it("전체 와일드카드 ∩ 아무 패턴 = 아무 패턴", () => {
    expect(patternMeet([null, null, null], ["3", "2", "5"], SHAPE))
      .toEqual(["3", "2", "5"]);
  });

  it("비연속 OR 교집합", () => {
    expect(patternMeet(["1,3,5", null, null], ["3,5,7", null, null], SHAPE))
      .toEqual(["3,5", null, null]);
  });

  it("교집합 결과가 전체 범위이면 null로 표현", () => {
    // 두 범위의 교집합이 dim 전체를 커버하면 와일드카드
    expect(patternMeet(["1-4", null, null], ["1-8", null, null], SHAPE))
      .toEqual(["1-4", null, null]);
  });
});

// ── patternJoin ──────────────────────────────────────────────────────────────

describe("patternJoin", () => {
  it("비연속 값의 합집합", () => {
    expect(patternJoin(["1-3", null, null], ["5-8", null, null], SHAPE))
      .toEqual(["1-3,5-8", null, null]);
  });

  it("인접한 범위 → 병합", () => {
    expect(patternJoin(["1-3", null, null], ["4-6", null, null], SHAPE))
      .toEqual(["1-6", null, null]);
  });

  it("합집합이 전체 범위 → 와일드카드", () => {
    expect(patternJoin(["1-4", null, null], ["5-8", null, null], SHAPE))
      .toEqual([null, null, null]);
  });

  it("동일 패턴 → 자기 자신", () => {
    expect(patternJoin(["3", "2", null], ["3", "2", null], SHAPE))
      .toEqual(["3", "2", null]);
  });

  it("여러 차원에서 각각 합집합", () => {
    expect(patternJoin(["3", "2", null], ["3", "4", null], SHAPE))
      .toEqual(["3", "2,4", null]);
  });
});

// ── patternSpecificity ───────────────────────────────────────────────────────

describe("patternSpecificity", () => {
  it("전체 와일드카드 → 0", () => {
    expect(patternSpecificity([null, null, null], SHAPE)).toBe(0);
  });

  it("단일 차원 고정 → (dimSize−1)/dimSize", () => {
    // shape[0] = 8, 단일 값 → 1 - 1/8 = 0.875
    expect(patternSpecificity(["3", null, null], SHAPE)).toBe(0.875);
  });

  it("두 차원 고정", () => {
    // 0.875 + (1 - 1/4) = 0.875 + 0.75 = 1.625
    expect(patternSpecificity(["3", "2", null], SHAPE)).toBe(1.625);
  });

  it("모든 차원 고정", () => {
    // 0.875 + 0.75 + (1 - 1/16) = 0.875 + 0.75 + 0.9375 = 2.5625
    expect(patternSpecificity(["3", "2", "5"], SHAPE)).toBe(2.5625);
  });

  it("범위 제약은 단일 값보다 덜 구체적", () => {
    // "1-4" covers 4 out of 8 → 1 - 4/8 = 0.5
    const rangeSpec = patternSpecificity(["1-4", null, null], SHAPE);
    const singleSpec = patternSpecificity(["3", null, null], SHAPE);
    expect(rangeSpec).toBe(0.5);
    expect(singleSpec).toBeGreaterThan(rangeSpec);
  });

  it("구체성 순서: A < B < C < D", () => {
    const a = patternSpecificity([null, null, null], SHAPE);
    const b = patternSpecificity(["3", null, null], SHAPE);
    const c = patternSpecificity(["3", "2", null], SHAPE);
    const d = patternSpecificity(["3", "2", "5"], SHAPE);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(d);
  });
});

// ── coordMatchesPattern ──────────────────────────────────────────────────────

describe("coordMatchesPattern", () => {
  it("전체 와일드카드 → 모든 좌표 매칭", () => {
    expect(coordMatchesPattern([1, 1, 1], [null, null, null], SHAPE)).toBe(true);
    expect(coordMatchesPattern([8, 4, 16], [null, null, null], SHAPE)).toBe(true);
  });

  it("단일 값 매칭", () => {
    expect(coordMatchesPattern([3, 2, 5], ["3", "2", null], SHAPE)).toBe(true);
    expect(coordMatchesPattern([3, 2, 5], ["3", "3", null], SHAPE)).toBe(false);
  });

  it("범위 매칭", () => {
    expect(coordMatchesPattern([3, 2, 5], ["1-5", null, null], SHAPE)).toBe(true);
    expect(coordMatchesPattern([6, 2, 5], ["1-5", null, null], SHAPE)).toBe(false);
  });

  it("비연속 OR 매칭", () => {
    expect(coordMatchesPattern([3, 2, 5], ["1,3,5", null, null], SHAPE)).toBe(true);
    expect(coordMatchesPattern([2, 2, 5], ["1,3,5", null, null], SHAPE)).toBe(false);
  });

  it("모든 차원 고정 — 정확한 좌표 매칭", () => {
    expect(coordMatchesPattern([3, 2, 5], ["3", "2", "5"], SHAPE)).toBe(true);
    expect(coordMatchesPattern([3, 2, 6], ["3", "2", "5"], SHAPE)).toBe(false);
  });

  it("경계값 테스트", () => {
    expect(coordMatchesPattern([1, 1, 1], ["1", "1", "1"], SHAPE)).toBe(true);
    expect(coordMatchesPattern([8, 4, 16], ["8", "4", "16"], SHAPE)).toBe(true);
  });
});

// ── Lattice 속성 검증 ────────────────────────────────────────────────────────

describe("lattice properties", () => {
  const A: (string | null)[] = [null, null, null];
  const B: (string | null)[] = ["3", null, null];
  const C: (string | null)[] = ["3", "2", null];
  const D: (string | null)[] = ["3", "2", "5"];

  it("포함 체인: A ⊇ B ⊇ C ⊇ D", () => {
    expect(patternContains(SHAPE, A, B)).toBe(true);
    expect(patternContains(SHAPE, B, C)).toBe(true);
    expect(patternContains(SHAPE, C, D)).toBe(true);
  });

  it("역방향 비포함: D ⊉ C ⊉ B ⊉ A", () => {
    expect(patternContains(SHAPE, D, C)).toBe(false);
    expect(patternContains(SHAPE, C, B)).toBe(false);
    expect(patternContains(SHAPE, B, A)).toBe(false);
  });

  it("meet(B, C) = C (B ⊇ C이므로)", () => {
    expect(patternMeet(B, C, SHAPE)).toEqual(C);
  });

  it("join(C, D) = C (C ⊇ D이므로)", () => {
    expect(patternJoin(C, D, SHAPE)).toEqual(C);
  });

  it("meet은 교환법칙 성립", () => {
    const p1: (string | null)[] = [null, "2", null];
    const p2: (string | null)[] = ["3", null, null];
    expect(patternMeet(p1, p2, SHAPE)).toEqual(patternMeet(p2, p1, SHAPE));
  });

  it("join은 교환법칙 성립", () => {
    const p1: (string | null)[] = ["1-3", null, null];
    const p2: (string | null)[] = ["5-8", null, null];
    expect(patternJoin(p1, p2, SHAPE)).toEqual(patternJoin(p2, p1, SHAPE));
  });

  it("meet 결과는 두 패턴 모두에 포함된다", () => {
    const p1: (string | null)[] = ["1-5", "2-3", null];
    const p2: (string | null)[] = ["3-8", null, "1-10"];
    const m = patternMeet(p1, p2, SHAPE);
    expect(m).not.toBeNull();
    expect(patternContains(SHAPE, p1, m!)).toBe(true);
    expect(patternContains(SHAPE, p2, m!)).toBe(true);
  });

  it("join 결과는 두 패턴을 모두 포함한다", () => {
    const p1: (string | null)[] = ["1-3", null, null];
    const p2: (string | null)[] = ["5-8", null, null];
    const j = patternJoin(p1, p2, SHAPE);
    expect(patternContains(SHAPE, j, p1)).toBe(true);
    expect(patternContains(SHAPE, j, p2)).toBe(true);
  });
});
