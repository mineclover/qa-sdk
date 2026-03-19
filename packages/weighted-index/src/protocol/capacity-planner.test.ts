import { describe, it, expect } from "vitest";
import { defineFormat } from "./pack-format.js";
import {
  fitShape,
  fitLayout,
  planCapacity,
} from "./capacity-planner.js";

// ═══════════════════════════════════════════════════════════════════════════
//  fitShape
// ═══════════════════════════════════════════════════════════════════════════

describe("fitShape", () => {
  it("returns null when shape already fits", () => {
    expect(fitShape({ shape: [8, 4, 5, 4], maxProduct: 640 })).toBeNull();
    expect(fitShape({ shape: [8, 4, 5, 4], maxProduct: 1000 })).toBeNull();
  });

  it("scales down a large shape to fit a tight budget", () => {
    const maxProduct = 16 ** 7;
    const result = fitShape({ shape: [99999, 999, 99, 99], maxProduct });
    expect(result).not.toBeNull();
    expect(result!.product).toBeLessThanOrEqual(maxProduct);
    expect(result!.utilization).toBeGreaterThan(0.9);
    expect(result!.shape.every((s, i) => s <= [99999, 999, 99, 99][i])).toBe(true);
  });

  it("product is always ≤ maxProduct", () => {
    const cases = [
      { shape: [1000, 500, 200], maxProduct: 100000 },
      { shape: [10, 10, 10, 10, 10], maxProduct: 50000 },
      { shape: [99999], maxProduct: 4096 },
    ];
    for (const c of cases) {
      const r = fitShape(c);
      if (r) expect(r.product).toBeLessThanOrEqual(c.maxProduct);
    }
  });

  it("respects min constraint", () => {
    const result = fitShape({ shape: [1000, 500], maxProduct: 100, min: 5 });
    expect(result).not.toBeNull();
    expect(result!.shape[0]).toBeGreaterThanOrEqual(5);
    expect(result!.shape[1]).toBeGreaterThanOrEqual(5);
  });

  it("keeps fixed dimensions unchanged", () => {
    const result = fitShape({
      shape: [1000, 500, 100],
      maxProduct: 5000,
      fixed: new Set([1]),
    });
    expect(result).not.toBeNull();
    expect(result!.shape[1]).toBe(500);
    expect(result!.product).toBeLessThanOrEqual(5000);
  });

  it("returns boundaries for each dimension", () => {
    const result = fitShape({ shape: [1000, 500], maxProduct: 1000 });
    expect(result).not.toBeNull();
    expect(result!.boundaries).toHaveLength(2);
  });

  it("returns null for empty shape", () => {
    expect(fitShape({ shape: [], maxProduct: 100 })).toBeNull();
  });

  it("single dimension — caps at maxProduct", () => {
    const result = fitShape({ shape: [99999], maxProduct: 4096 });
    expect(result).not.toBeNull();
    expect(result!.shape[0]).toBe(4096);
    expect(result!.product).toBe(4096);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  fitLayout
// ═══════════════════════════════════════════════════════════════════════════

describe("fitLayout", () => {
  const left = [{ name: "prefix", chars: 4 }, { name: "version", chars: 1 }] as const;

  it("accepts built-in name string", () => {
    const result = fitLayout({
      shape: [99999, 999, 99, 99],
      left: [...left],
      capacity: "int64",
    });
    expect(result).not.toBeNull();
    expect(result!.format.name).toBe("int64");
    expect(result!.indexBudget).toBe(11);
  });

  it("accepts PackFormat object (custom)", () => {
    const custom = defineFormat({ name: "my48", chars: 12, label: "48-bit" });
    const result = fitLayout({
      shape: [99999, 999, 99, 99],
      left: [...left],
      capacity: custom,
    });
    expect(result).not.toBeNull();
    expect(result!.format).toBe(custom);
    expect(result!.indexBudget).toBe(7); // 12 - 4 - 1
  });

  it("accepts raw number", () => {
    const result = fitLayout({
      shape: [99999, 999, 99, 99],
      left: [...left],
      capacity: 16,
    });
    expect(result).not.toBeNull();
    expect(result!.format.chars).toBe(16);
  });

  it("returns result with plan when shape already fits", () => {
    const result = fitLayout({
      shape: [8, 4, 5, 4],
      left: [{ name: "prefix", chars: 4 }],
      capacity: "uuid",
    });
    expect(result).not.toBeNull();
    expect(result!.shape).toEqual([8, 4, 5, 4]);
    expect(result!.plan.fitsUUID).toBe(true);
  });

  it("returns null when left fields consume all capacity", () => {
    const result = fitLayout({
      shape: [100],
      left: [{ name: "huge", chars: 16 }],
      capacity: "int64",
    });
    expect(result).toBeNull();
  });

  it("uuid capacity gives more room than int64", () => {
    const r64 = fitLayout({ shape: [99999, 999, 99, 99], left: [...left], capacity: "int64" });
    const rUuid = fitLayout({ shape: [99999, 999, 99, 99], left: [...left], capacity: "uuid" });
    expect(r64).not.toBeNull();
    expect(rUuid).not.toBeNull();
    expect(rUuid!.product).toBeGreaterThanOrEqual(r64!.product);
  });

  it("fitLayout result includes format info", () => {
    const result = fitLayout({
      shape: [99999, 999, 99, 99],
      left: [...left],
      capacity: "uuid",
    });
    expect(result!.format.name).toBe("uuid");
    expect(result!.format.groups).toEqual([8, 4, 4, 4, 12]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  planCapacity
// ═══════════════════════════════════════════════════════════════════════════

describe("planCapacity", () => {
  const left = [
    { name: "prefix", chars: 4 },
    { name: "version", chars: 2 },
  ];

  it("기본(growth 미지정): current만큼 추가 → nextPow2", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 5 },     // 5+5=10 → 16
        { name: "action", current: 8 },    // 8+8=16 → 16
        { name: "resource", current: 3 },  // 3+3=6 → 8
      ],
      left,
      capacity: "uuid",
    });

    expect(result.shape).toEqual([16, 16, 8]);
    expect(result.fits).toBe(true);
    expect(result.product).toBe(16 * 16 * 8);
  });

  it("growth=0: 추가 여유 없음, current → nextPow2", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 5, growth: 0 },     // 5+0=5 → 8
        { name: "action", current: 8, growth: 0 },    // 8+0=8 → 8
      ],
      left,
      capacity: "uuid",
    });

    expect(result.shape).toEqual([8, 8]);
    expect(result.fits).toBe(true);
  });

  it("명시적 growth: current + growth → nextPow2", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 5, growth: 3 },      // 5+3=8 → 8
        { name: "action", current: 8, growth: 0 },     // 8+0=8 → 8
        { name: "resource", current: 3, growth: 10 },  // 3+10=13 → 16
      ],
      left,
      capacity: "uuid",
    });

    expect(result.shape).toEqual([8, 8, 16]);
    expect(result.fits).toBe(true);
    expect(result.product).toBe(8 * 8 * 16);
  });

  it("16 capa, growth 미지정 → 32로 확장 (기본 2배 headroom)", () => {
    const result = planCapacity({
      dims: [{ name: "role", current: 16 }],
      left,
      capacity: "uuid",
    });

    // 16+16=32 → nextPow2(32)=32
    expect(result.shape).toEqual([32]);
    expect(result.dims[0].recommended).toBe(32);
    expect(result.dims[0].headroom).toBe(0.5); // (32-16)/32
  });

  it("growth/current > 1.0이면 shardingAdvised=true", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 3, growth: 10 },  // 10/3 > 1.0 → volatile
        { name: "action", current: 8, growth: 2 },  // 2/8 = 0.25 → stable
      ],
      left,
      capacity: "uuid",
    });
    expect(result.shardingAdvised).toBe(true);
  });

  it("모든 dim의 growth/current ≤ 1.0이면 shardingAdvised=false", () => {
    const result = planCapacity({
      dims: [
        { name: "a", current: 10, growth: 5 },   // 5/10 = 0.5
        { name: "b", current: 8, growth: 0 },     // 0/8 = 0
      ],
      left,
      capacity: "uuid",
    });
    expect(result.shardingAdvised).toBe(false);
  });

  it("dims[].growth에 입력값이 반영된다", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 5, growth: 3 },
        { name: "action", current: 8 },  // growth 미지정 → current(8)
      ],
      left,
      capacity: "uuid",
    });

    expect(result.dims[0].growth).toBe(3);
    expect(result.dims[1].growth).toBe(8); // 기본값 = current
  });

  it("포맷 예산 초과 시 fitShape로 축소하되 current 이상 보장", () => {
    const result = planCapacity({
      dims: [
        { name: "a", current: 100000, growth: 500000 },
        { name: "b", current: 50000, growth: 500000 },
      ],
      left,
      capacity: "int64",
    });

    expect(result.shape[0]).toBeGreaterThanOrEqual(100000);
    expect(result.shape[1]).toBeGreaterThanOrEqual(50000);
  });

  it("각 dim의 hexChars 정보를 포함한다", () => {
    const result = planCapacity({
      dims: [
        { name: "role", current: 5, growth: 3 },      // 8 → 1 hex char
        { name: "action", current: 200, growth: 50 },   // 250 → 256 → 2 hex chars
      ],
      left,
      capacity: "uuid",
    });

    expect(result.dims[0].hexChars).toBe(1);
    expect(result.dims[1].hexChars).toBe(2);
  });

  it("plan에 index 필드가 포함된다", () => {
    const result = planCapacity({
      dims: [{ name: "x", current: 10 }],
      left,
      capacity: "uuid",
    });

    expect(result.plan.fields.some(f => f.name === "index")).toBe(true);
    expect(result.plan.fields.some(f => f.name === "prefix")).toBe(true);
    expect(result.plan.fields.some(f => f.name === "version")).toBe(true);
  });

  it("shardChars를 지정하면 index budget이 줄어든다", () => {
    const withoutShard = planCapacity({
      dims: [{ name: "x", current: 10 }],
      left,
      capacity: "uuid",
    });
    const withShard = planCapacity({
      dims: [{ name: "x", current: 10 }],
      left,
      capacity: "uuid",
      shardChars: 2,
    });

    expect(withShard.indexBudget).toBe(withoutShard.indexBudget - 2);
  });

  it("빈 dims는 product=1, shape=[]", () => {
    const result = planCapacity({
      dims: [],
      left,
      capacity: "uuid",
    });
    expect(result.shape).toEqual([]);
    expect(result.product).toBe(1);
    expect(result.fits).toBe(true);
  });

  it("실제 enum 정의 시나리오: 권한 시스템", () => {
    // 실제로 열거해본 결과:
    //   role: admin, editor, viewer, guest, moderator (5개, 앞으로 2~3개 추가 예상)
    //   action: read, write, delete, approve (4개, 거의 안 변함)
    //   resource: articles, users, settings, billing (4개, 2개 정도 추가 가능)
    const result = planCapacity({
      dims: [
        { name: "role",     current: 5, growth: 3 },  // 5+3=8  → 8
        { name: "action",   current: 4, growth: 0 },  // 4+0=4  → 4
        { name: "resource", current: 4, growth: 2 },  // 4+2=6  → 8
      ],
      left,
      capacity: "uuid",
    });

    expect(result.shape).toEqual([8, 4, 8]);
    expect(result.product).toBe(256);
    expect(result.fits).toBe(true);
    expect(result.shardingAdvised).toBe(false);  // 모든 growth/current ≤ 1.0

    // headroom 확인
    expect(result.dims[0].headroom).toBeCloseTo(3 / 8);  // (8-5)/8
    expect(result.dims[1].headroom).toBe(0);              // 딱 맞음
    expect(result.dims[2].headroom).toBe(0.5);            // (8-4)/8
  });
});
