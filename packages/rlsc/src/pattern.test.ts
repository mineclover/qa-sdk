import { describe, it, expect } from "vitest";
import { classifyLayout } from "./pattern.js";
import type { LayoutMetrics, ProximityGroup } from "./types.js";

// ── 헬퍼 ─────────────────────────────────────────────────────────────

function makeMetrics(overrides?: Partial<LayoutMetrics>): LayoutMetrics {
  return {
    balance: { x: 1.0, y: 1.0 },
    dominantFlow: "free",
    gridPattern: null,
    goldenRatioScore: 0,
    proximityGroups: [],
    columnSystem: null,
    spacingValues: [],
    spacingBase: null,
    aspectRatioDistribution: [],
    ...overrides,
  };
}

function proximity(
  x: number,
  y: number,
): ProximityGroup {
  return {
    nodeIds: ["n"],
    centroid: { x, y },
    boundingRect: { x, y, width: 10, height: 10 },
  };
}

// ── gridPattern ───────────────────────────────────────────────────────

describe("classifyLayout — gridPattern", () => {
  it("null → gridPattern 필드 없음", () => {
    const p = classifyLayout(makeMetrics({ gridPattern: null }));
    expect(p.gridPattern).toBeUndefined();
  });

  it("{cols:3, rows:3} → '3x3'", () => {
    const p = classifyLayout(makeMetrics({ gridPattern: { cols: 3, rows: 3 } }));
    expect(p.gridPattern).toBe("3x3");
  });

  it("{cols:1, rows:1} → '1-col'", () => {
    const p = classifyLayout(makeMetrics({ gridPattern: { cols: 1, rows: 1 } }));
    expect(p.gridPattern).toBe("1-col");
  });

  it("{cols:2, rows:1} → '2-col'", () => {
    const p = classifyLayout(makeMetrics({ gridPattern: { cols: 2, rows: 1 } }));
    expect(p.gridPattern).toBe("2-col");
  });

  it("{cols:4, rows:2} → 객체 그대로", () => {
    const p = classifyLayout(makeMetrics({ gridPattern: { cols: 4, rows: 2 } }));
    expect(p.gridPattern).toEqual({ cols: 4, rows: 2 });
  });
});

// ── flowDirection ─────────────────────────────────────────────────────

describe("classifyLayout — flowDirection", () => {
  it("horizontal → 'left-to-right'", () => {
    const p = classifyLayout(makeMetrics({ dominantFlow: "horizontal" }));
    expect(p.flowDirection).toBe("left-to-right");
  });

  it("vertical → 'top-to-bottom'", () => {
    const p = classifyLayout(makeMetrics({ dominantFlow: "vertical" }));
    expect(p.flowDirection).toBe("top-to-bottom");
  });

  it("grid → 'grid'", () => {
    const p = classifyLayout(makeMetrics({ dominantFlow: "grid" }));
    expect(p.flowDirection).toBe("grid");
  });

  it("free → flowDirection 필드 없음", () => {
    const p = classifyLayout(makeMetrics({ dominantFlow: "free" }));
    expect(p.flowDirection).toBeUndefined();
  });
});

// ── goldenRatio ───────────────────────────────────────────────────────

describe("classifyLayout — goldenRatio", () => {
  it("score >= 0.8 → goldenRatio: true", () => {
    const p = classifyLayout(makeMetrics({ goldenRatioScore: 0.9 }));
    expect(p.goldenRatio).toBe(true);
  });

  it("score < 0.8 → 필드 없음", () => {
    const p = classifyLayout(makeMetrics({ goldenRatioScore: 0.5 }));
    expect(p.goldenRatio).toBeUndefined();
  });
});

// ── balanceRatio ──────────────────────────────────────────────────────

describe("classifyLayout — balanceRatio", () => {
  it("x ≈ 1 (균형) → 필드 없음", () => {
    const p = classifyLayout(makeMetrics({ balance: { x: 1.0, y: 1.0 } }));
    expect(p.balanceRatio).toBeUndefined();
  });

  it("x = 3 (왼쪽 치우침) → balanceRatio.x 설정", () => {
    const p = classifyLayout(makeMetrics({ balance: { x: 3.0, y: 1.0 } }));
    expect(p.balanceRatio?.x).toBeDefined();
  });
});

// ── gestalt ───────────────────────────────────────────────────────────

describe("classifyLayout — gestalt", () => {
  it("2개 그룹, 평균 거리 ≤ 16 → proximity: 'tight'", () => {
    const groups = [proximity(0, 0), proximity(10, 0)];
    const p = classifyLayout(makeMetrics({ proximityGroups: groups }));
    expect(p.gestalt?.proximity).toBe("tight");
  });

  it("2개 그룹, 평균 거리 17–64 → proximity: 'loose'", () => {
    const groups = [proximity(0, 0), proximity(40, 0)];
    const p = classifyLayout(makeMetrics({ proximityGroups: groups }));
    expect(p.gestalt?.proximity).toBe("loose");
  });

  it("그룹 1개 → gestalt 없음", () => {
    const p = classifyLayout(makeMetrics({ proximityGroups: [proximity(0, 0)] }));
    expect(p.gestalt).toBeUndefined();
  });
});

// ── gridSystem ────────────────────────────────────────────────────────

describe("classifyLayout — gridSystem", () => {
  it("columnSystem 있으면 gridSystem 생성", () => {
    const p = classifyLayout(makeMetrics({
      columnSystem: { cols: 12, gutterPx: 24, marginPx: 32 },
    }));
    expect(p.gridSystem?.columns).toBe(12);
    expect(p.gridSystem?.gutter).toBe(24);
    expect(p.gridSystem?.margin).toBe(32);
  });

  it("columnSystem null → gridSystem 없음", () => {
    const p = classifyLayout(makeMetrics({ columnSystem: null }));
    expect(p.gridSystem).toBeUndefined();
  });
});

// ── spacing ───────────────────────────────────────────────────────────

describe("classifyLayout — spacing", () => {
  it("spacingValues 있고 base=8, 모두 배수 → consistent: true", () => {
    const p = classifyLayout(makeMetrics({
      spacingValues: [8, 16, 24],
      spacingBase: 8,
    }));
    expect(p.spacing?.base).toBe(8);
    expect(p.spacing?.consistent).toBe(true);
    expect(p.spacing?.scale).toEqual([8, 16, 24]);
  });

  it("spacingValues 없음 → spacing 없음", () => {
    const p = classifyLayout(makeMetrics({ spacingValues: [] }));
    expect(p.spacing).toBeUndefined();
  });
});

// ── proportions ───────────────────────────────────────────────────────

describe("classifyLayout — proportions", () => {
  it("황금비 비율 dominant → namedRatio: 'golden'", () => {
    const p = classifyLayout(makeMetrics({
      aspectRatioDistribution: [
        { ratio: 1.618, count: 5 },
        { ratio: 1.0, count: 2 },
      ],
    }));
    expect(p.proportions?.dominant).toBeCloseTo(1.618, 2);
    expect(p.proportions?.namedRatio).toBe("golden");
  });

  it("16:9 비율 → namedRatio: '16:9'", () => {
    const p = classifyLayout(makeMetrics({
      aspectRatioDistribution: [{ ratio: 1.78, count: 3 }],
    }));
    expect(p.proportions?.namedRatio).toBe("16:9");
  });

  it("비율 분포 없음 → proportions 없음", () => {
    const p = classifyLayout(makeMetrics({ aspectRatioDistribution: [] }));
    expect(p.proportions).toBeUndefined();
  });
});
