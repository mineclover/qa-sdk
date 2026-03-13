import { describe, it, expect } from "vitest";
import { calcWeights, partialQueryBase, describeRangeFormula } from "./calc.js";
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
