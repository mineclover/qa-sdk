import { describe, it, expect } from "vitest";
import { calcWeights, partialQueryBase, describeRangeFormula, mergeRanges, intersectRanges, subtractRanges, complementRanges, containsAddress, positionsToConstraint, calcAddressRanges } from "./calc.js";
import { WeightedIndex } from "./weighted-index.js";

// ── calcWeights ────────────────────────────────────────────────────────────

describe("calcWeights", () => {
  it("single dimension → weight is 1", () => {
    expect(calcWeights([8])).toEqual([1]);
  });

  it("2D [8,4] → [4,1]", () => {
    expect(calcWeights([8, 4])).toEqual([4, 1]);
  });

  it("4D [8,4,5,4] → [80,20,4,1]", () => {
    expect(calcWeights([8, 4, 5, 4])).toEqual([80, 20, 4, 1]);
  });

  it("last weight is always 1", () => {
    const w = calcWeights([3, 5, 7, 2]);
    expect(w[w.length - 1]).toBe(1);
  });

  it("W[0] × shape[0] equals total size", () => {
    const shape = [8, 4, 5, 4];
    const weights = calcWeights(shape);
    const expectedSize = shape.reduce((a, b) => a * b, 1);
    expect(weights[0] * shape[0]).toBe(expectedSize);
  });

  it("consistent with WeightedIndex encode for known coords", () => {
    // encode([3,2,4,1]) with shape [8,4,5,4]:
    // weights = [80,20,4,1]
    // id = (3-1)*80 + (2-1)*20 + (4-1)*4 + (1-1)*1 = 160+20+12+0 = 192
    const weights = calcWeights([8, 4, 5, 4]);
    const id = [3, 2, 4, 1].reduce((acc, x, i) => acc + (x - 1) * weights[i], 0);
    expect(id).toBe(192);
  });

  it("shape [1] → [1] (single-slot dimension weight is 1)", () => {
    expect(calcWeights([1])).toEqual([1]);
  });
});

// ── intersectRanges ────────────────────────────────────────

describe("intersectRanges", () => {
  it("겹치는 구간의 교집합", () => {
    expect(intersectRanges([[0, 10]], [[5, 15]])).toEqual([[5, 10]]);
  });

  it("겹치지 않으면 빈 배열", () => {
    expect(intersectRanges([[0, 5]], [[10, 15]])).toEqual([]);
  });

  it("완전히 포함되면 작은 구간 반환", () => {
    expect(intersectRanges([[0, 100]], [[20, 30]])).toEqual([[20, 30]]);
  });

  it("여러 구간의 교집합", () => {
    // a: [0,10], [20,30]
    // b: [5,25]
    // 교집합: [5,10], [20,25]
    expect(intersectRanges([[0, 10], [20, 30]], [[5, 25]])).toEqual([[5, 10], [20, 25]]);
  });
});

// ── partialQueryBase ───────────────────────────────────────────────────────

describe("partialQueryBase", () => {
  const W = [80, 20, 4, 1] as const;

  it("all null → base is 0", () => {
    expect(partialQueryBase(W, [null, null, null, null])).toBe(0);
  });

  it("all fixed → equals full encode", () => {
    // encode([4,2,3,1]) = (4-1)*80+(2-1)*20+(3-1)*4+(1-1)*1 = 240+20+8+0 = 268
    expect(partialQueryBase(W, [4, 2, 3, 1])).toBe(268);
  });

  it("fix role=4 and env=1 → (4-1)*4 + 0 = 12", () => {
    expect(partialQueryBase(W, [null, null, 4, 1])).toBe(12);
  });

  it("fix only env=2 → (2-1)*1 = 1", () => {
    expect(partialQueryBase(W, [null, null, null, 2])).toBe(1);
  });

  it("fix resource=1 → 0 (coord 1 always contributes 0)", () => {
    expect(partialQueryBase(W, [1, null, null, null])).toBe(0);
  });

  it("all fixed matches WeightedIndex.encode for same coords", () => {
    const shape = [8, 4, 5, 4] as const;
    const wi = new WeightedIndex([...shape]);
    const weights = calcWeights(shape);
    const coords: Array<[number, number, number, number]> = [
      [1, 1, 1, 1],
      [8, 4, 5, 4],
      [3, 2, 4, 1],
      [5, 3, 2, 3],
    ];
    for (const c of coords) {
      expect(partialQueryBase(weights, c)).toBe(wi.encode(c));
    }
  });
});

// ── describeRangeFormula ───────────────────────────────────────────────────

describe("describeRangeFormula", () => {
  const W      = [80, 20, 4, 1] as const;
  const labels = ["resource", "action", "role", "env"] as const;

  it("all fixed → returns constant string", () => {
    expect(describeRangeFormula(W, [4, 2, 3, 1], labels)).toBe("268");
  });

  it("all free → symbolic expression with no numeric prefix", () => {
    const f = describeRangeFormula(W, [null, null, null, null], labels);
    expect(f).toBe("(resource−1)×80 + (action−1)×20 + (role−1)×4 + (env−1)×1");
  });

  it("partial fix: base + free terms", () => {
    // fix role=4(base=12), env=1(base+=0) → base=12, free = resource + action
    const f = describeRangeFormula(W, [null, null, 4, 1], labels);
    expect(f).toBe("12 + (resource−1)×80 + (action−1)×20");
  });

  it("base=0 with free dims: no leading zero", () => {
    // fix resource=1 → base=0, rest free
    const f = describeRangeFormula(W, [1, null, null, null], labels);
    expect(f.startsWith("0")).toBe(false);
    expect(f).toBe("(action−1)×20 + (role−1)×4 + (env−1)×1");
  });

  it("single free dimension in the middle", () => {
    // fix resource=2, role=4, env=1 → base=(1)*80+(3)*4+0=92, free=action
    const f = describeRangeFormula(W, [2, null, 4, 1], labels);
    expect(f).toBe("92 + (action−1)×20");
  });

  it("single free dimension, base=0 → no numeric prefix", () => {
    // fix resource=1, role=1, env=1 → base=0, free=action only
    const f = describeRangeFormula(W, [1, null, 1, 1], labels);
    expect(f).toBe("(action−1)×20");
  });
});

// ── mergeRanges ────────────────────────────────────────────

describe("mergeRanges", () => {
  it("빈 배열 → 빈 배열", () => {
    expect(mergeRanges([])).toEqual([]);
  });

  it("인접한 구간은 병합된다", () => {
    expect(mergeRanges([[0, 2], [3, 5]])).toEqual([[0, 5]]);
  });

  it("겹치는 구간은 병합된다", () => {
    expect(mergeRanges([[0, 5], [3, 8]])).toEqual([[0, 8]]);
  });

  it("떨어진 구간은 유지된다", () => {
    expect(mergeRanges([[0, 2], [10, 12]])).toEqual([[0, 2], [10, 12]]);
  });

  it("정렬 후 병합된다", () => {
    expect(mergeRanges([[10, 12], [0, 2], [3, 5]])).toEqual([[0, 5], [10, 12]]);
  });
});

// ── subtractRanges ────────────────────────────────────────

describe("subtractRanges", () => {
  it("empty exclude → returns base unchanged", () => {
    expect(subtractRanges([[0, 10], [20, 30]], [])).toEqual([[0, 10], [20, 30]]);
  });

  it("complete exclusion → empty result", () => {
    expect(subtractRanges([[0, 10]], [[0, 10]])).toEqual([]);
  });

  it("partial exclusion from middle → splits into two ranges", () => {
    expect(subtractRanges([[0, 10]], [[3, 7]])).toEqual([[0, 2], [8, 10]]);
  });

  it("multiple exclusion segments", () => {
    expect(subtractRanges([[0, 20]], [[2, 4], [10, 12]])).toEqual([[0, 1], [5, 9], [13, 20]]);
  });

  it("no overlap between base and exclude → base unchanged", () => {
    expect(subtractRanges([[0, 5]], [[10, 15]])).toEqual([[0, 5]]);
  });

  it("single-point exclusion", () => {
    expect(subtractRanges([[0, 5]], [[3, 3]])).toEqual([[0, 2], [4, 5]]);
  });
});

// ── complementRanges ──────────────────────────────────────

describe("complementRanges", () => {
  it("empty excluded → full range [0, capacity-1]", () => {
    expect(complementRanges(10, [])).toEqual([[0, 9]]);
  });

  it("full exclusion → empty result", () => {
    expect(complementRanges(10, [[0, 9]])).toEqual([]);
  });

  it("gap at start/middle/end", () => {
    // excluded [3,6] → gaps [0,2] and [7,9]
    expect(complementRanges(10, [[3, 6]])).toEqual([[0, 2], [7, 9]]);
  });

  it("multiple gaps", () => {
    expect(complementRanges(20, [[2, 4], [10, 12]])).toEqual([[0, 1], [5, 9], [13, 19]]);
  });

  it("capacity = 0 → empty", () => {
    expect(complementRanges(0, [])).toEqual([]);
  });
});

// ── containsAddress ───────────────────────────────────────

describe("containsAddress", () => {
  it("empty ranges → false", () => {
    expect(containsAddress(5, [])).toBe(false);
  });

  it("address in single range → true", () => {
    expect(containsAddress(5, [[0, 10]])).toBe(true);
  });

  it("address before all ranges → false", () => {
    expect(containsAddress(0, [[5, 10]])).toBe(false);
  });

  it("address after all ranges → false", () => {
    expect(containsAddress(20, [[0, 10]])).toBe(false);
  });

  it("address between ranges → false", () => {
    expect(containsAddress(7, [[0, 5], [10, 15]])).toBe(false);
  });

  it("address at boundary (from/to) → true", () => {
    expect(containsAddress(0, [[0, 10]])).toBe(true);
    expect(containsAddress(10, [[0, 10]])).toBe(true);
  });

  it("multiple ranges binary search works", () => {
    const ranges: [number, number][] = [[0, 2], [10, 12], [20, 22], [30, 32], [40, 42]];
    expect(containsAddress(1, ranges)).toBe(true);
    expect(containsAddress(11, ranges)).toBe(true);
    expect(containsAddress(21, ranges)).toBe(true);
    expect(containsAddress(31, ranges)).toBe(true);
    expect(containsAddress(41, ranges)).toBe(true);
    expect(containsAddress(5, ranges)).toBe(false);
    expect(containsAddress(15, ranges)).toBe(false);
    expect(containsAddress(25, ranges)).toBe(false);
    expect(containsAddress(35, ranges)).toBe(false);
    expect(containsAddress(50, ranges)).toBe(false);
  });
});

// ── positionsToConstraint ─────────────────────────────────

describe("positionsToConstraint", () => {
  it('consecutive positions → "a-b"', () => {
    expect(positionsToConstraint([6, 7, 8])).toBe("6-8");
  });

  it('non-consecutive → "a,b,c"', () => {
    expect(positionsToConstraint([1, 3, 5])).toBe("1,3,5");
  });

  it('mixed → "a-b,d,f-h"', () => {
    expect(positionsToConstraint([1, 2, 4, 6, 7, 8])).toBe("1-2,4,6-8");
  });

  it('single position → "n"', () => {
    expect(positionsToConstraint([42])).toBe("42");
  });

  it('empty array → ""', () => {
    expect(positionsToConstraint([])).toBe("");
  });

  it("unsorted input → correct (sorted internally)", () => {
    expect(positionsToConstraint([8, 6, 7])).toBe("6-8");
    expect(positionsToConstraint([5, 1, 3])).toBe("1,3,5");
  });
});

// ── calcAddressRanges ─────────────────────────────────────
//
// shape = [8, 4, 16, 4]  (role, action, resource, env)
// weights = [256, 64, 4, 1]
// capacity = 2048

describe("calcAddressRanges", () => {
  const SHAPE = [8, 4, 16, 4] as const;

  // ── 모든 와일드카드 ────────────────────────────────────────

  it("전체 와일드카드 → 전체 공간", () => {
    expect(calcAddressRanges(SHAPE, [null, null, null, null])).toEqual([[0, 2047]]);
  });

  // ── 단일 값 고정 ──────────────────────────────────────────

  it('"3" — role=3 → 1개 연속 구간 [512, 767]', () => {
    const ranges = calcAddressRanges(SHAPE, ["3", null, null, null]);
    expect(ranges).toEqual([[512, 767]]);
    expect(ranges[0][1] - ranges[0][0] + 1).toBe(256);
  });

  it('"3","1" — role=3, env=1 → 64개 구간 (4 간격)', () => {
    const ranges = calcAddressRanges(SHAPE, ["3", null, null, "1"]);
    expect(ranges.length).toBe(4 * 16);
    expect(ranges[0]).toEqual([512, 512]);
    expect(ranges[1]).toEqual([516, 516]);
    const total = ranges.reduce((s, [f, t]) => s + t - f + 1, 0);
    expect(total).toBe(64);
  });

  it('"3","2","4","1" — 모든 차원 고정 → 단일 주소 588', () => {
    expect(calcAddressRanges(SHAPE, ["3", "2", "4", "1"])).toEqual([[588, 588]]);
  });

  // ── 범위 (a-b) ────────────────────────────────────────────

  it('"2-4" — role=2..4 → 1개 연속 구간 [256, 1023]', () => {
    expect(calcAddressRanges(SHAPE, ["2-4", null, null, null])).toEqual([[256, 1023]]);
  });

  it('"3-4" — role=3..4 → [512, 1023] (인접 병합)', () => {
    expect(calcAddressRanges(SHAPE, ["3-4", null, null, null])).toEqual([[512, 1023]]);
  });

  // ── 비연속 OR (a,b 또는 a-b,c-d) ──────────────────────────

  it('"1,3" — role=1 OR role=3 → 2개 비인접 구간', () => {
    const ranges = calcAddressRanges(SHAPE, ["1,3", null, null, null]);
    expect(ranges).toEqual([[0, 255], [512, 767]]);
  });

  it('"1-2,4" — role=1..2 OR role=4 → 2개 구간', () => {
    // role=1,2: [0,511], role=4: [768,1023]
    const ranges = calcAddressRanges(SHAPE, ["1-2,4", null, null, null]);
    expect(ranges).toEqual([[0, 511], [768, 1023]]);
  });

  // ── WeightedIndex 일관성 ──────────────────────────────────

  it("단일 값의 주소가 WeightedIndex.encode와 일치한다", () => {
    const wi = new WeightedIndex([...SHAPE]);
    const encoded = wi.encode([3, 2, 4, 1]);
    expect(calcAddressRanges(SHAPE, ["3", "2", "4", "1"])).toEqual([[encoded, encoded]]);
  });

  it('"3" 범위 내 모든 주소를 WeightedIndex로 검증', () => {
    const wi = new WeightedIndex([...SHAPE]);
    const [[from, to]] = calcAddressRanges(SHAPE, ["3", null, null, null]);
    for (let addr = from; addr <= to; addr++) {
      expect(wi.decode(addr)[0]).toBe(3);
    }
  });

  // ── intersectRanges — AND 조건 ────────────────────────────

  it("intersectRanges — role=3 AND env=1", () => {
    const combined = intersectRanges(
      calcAddressRanges(SHAPE, ["3", null, null, null]),
      calcAddressRanges(SHAPE, [null, null, null, "1"]),
    );
    expect(combined).toEqual(calcAddressRanges(SHAPE, ["3", null, null, "1"]));
  });

  // ── n차원 확장 ────────────────────────────────────────────

  // ── _normalizeConstraint validation ────────────────────────────────

  describe("constraint parsing validation", () => {
    it('inverted range "5-3" throws RangeError', () => {
      expect(() => calcAddressRanges(SHAPE, ["5-3", null, null, null])).toThrow(RangeError);
    });

    it('NaN values like "abc" throw RangeError', () => {
      expect(() => calcAddressRanges(SHAPE, ["abc", null, null, null])).toThrow(RangeError);
    });

    it("out-of-range value 0 throws RangeError (1-based coords)", () => {
      expect(() => calcAddressRanges(SHAPE, ["0", null, null, null])).toThrow(RangeError);
    });

    it("out-of-range value exceeding dimSize throws RangeError", () => {
      // SHAPE[0] = 8, so "9" exceeds dimSize
      expect(() => calcAddressRanges(SHAPE, ["9", null, null, null])).toThrow(RangeError);
    });

    it("valid constraints still work correctly", () => {
      // "1" is valid for dim with size 8
      expect(calcAddressRanges(SHAPE, ["1", null, null, null])).toEqual([[0, 255]]);
      // "1-8" covers the full first dimension
      expect(calcAddressRanges(SHAPE, ["1-8", null, null, null])).toEqual([[0, 2047]]);
      // boundary: exact dimSize is valid
      expect(calcAddressRanges(SHAPE, ["8", null, null, null])).toEqual([[1792, 2047]]);
    });
  });

  it("5D shape — 문자열 제약 동일하게 동작한다", () => {
    const shape5D = [4, 3, 5, 2, 6];
    const [[from, to]] = calcAddressRanges(shape5D, ["2", null, null, null, null]);
    expect(from).toBe(180); // (2-1) × 180
    expect(to).toBe(359);

    const ranges = calcAddressRanges(shape5D, [null, null, null, null, "1"]);
    expect(ranges.length).toBe(4 * 3 * 5 * 2); // 120
    expect(ranges[0]).toEqual([0, 0]);
    expect(ranges[1]).toEqual([6, 6]);
  });
});
