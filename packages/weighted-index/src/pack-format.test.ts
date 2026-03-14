import { describe, it, expect } from "vitest";
import {
  PACK_FORMATS,
  PACK_FORMAT_LIST,
  defineFormat,
  FormatRegistry,
  createFormatRegistry,
  formatHex,
  parseHex,
  hexBoundary,
  hexCeil,
  hexFloor,
  fitShape,
  fitLayout,
  planCapacity,
} from "./pack-format.js";

// ═══════════════════════════════════════════════════════════════════════════
//  PACK_FORMATS
// ═══════════════════════════════════════════════════════════════════════════

describe("PACK_FORMATS", () => {
  it("has 5 built-in formats", () => {
    expect(Object.keys(PACK_FORMATS)).toHaveLength(5);
  });

  it("bits = chars × 4 for all formats", () => {
    for (const fmt of PACK_FORMAT_LIST) {
      expect(fmt.bits).toBe(fmt.chars * 4);
    }
  });

  it("PACK_FORMAT_LIST is sorted by chars ascending", () => {
    for (let i = 1; i < PACK_FORMAT_LIST.length; i++) {
      expect(PACK_FORMAT_LIST[i].chars).toBeGreaterThanOrEqual(PACK_FORMAT_LIST[i - 1].chars);
    }
  });

  it("uuid has groups [8,4,4,4,12]", () => {
    expect(PACK_FORMATS.uuid.groups).toEqual([8, 4, 4, 4, 12]);
  });

  it("int64 has no groups", () => {
    expect(PACK_FORMATS.int64.groups).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  defineFormat
// ═══════════════════════════════════════════════════════════════════════════

describe("defineFormat", () => {
  it("creates a frozen format with bits auto-computed", () => {
    const fmt = defineFormat({ name: "test", chars: 20, label: "Test" });
    expect(fmt.bits).toBe(80);
    expect(fmt.groups).toBeUndefined();
    expect(Object.isFrozen(fmt)).toBe(true);
  });

  it("validates groups sum matches chars", () => {
    expect(() => defineFormat({
      name: "bad", chars: 10, label: "Bad", groups: [4, 4],
    })).toThrow(RangeError);
  });

  it("rejects groups with zero or negative values", () => {
    expect(() => defineFormat({
      name: "bad", chars: 4, label: "Bad", groups: [4, 0],
    })).toThrow(RangeError);
  });

  it("rejects chars ≤ 0", () => {
    expect(() => defineFormat({ name: "bad", chars: 0, label: "Bad" })).toThrow(RangeError);
  });

  it("rejects empty name", () => {
    expect(() => defineFormat({ name: "", chars: 8, label: "Bad" })).toThrow(RangeError);
  });

  it("accepts valid groups", () => {
    const fmt = defineFormat({ name: "g", chars: 12, label: "G", groups: [4, 4, 4] });
    expect(fmt.groups).toEqual([4, 4, 4]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FormatRegistry
// ═══════════════════════════════════════════════════════════════════════════

describe("FormatRegistry", () => {
  it("createFormatRegistry includes all built-ins", () => {
    const reg = createFormatRegistry();
    expect(reg.size).toBe(5);
    expect(reg.has("uuid")).toBe(true);
    expect(reg.has("int64")).toBe(true);
  });

  it("register adds custom formats", () => {
    const reg = createFormatRegistry();
    const custom = defineFormat({ name: "cuid", chars: 20, label: "CUID" });
    reg.register(custom);
    expect(reg.has("cuid")).toBe(true);
    expect(reg.get("cuid")).toBe(custom);
    expect(reg.size).toBe(6);
  });

  it("require throws for unknown name", () => {
    const reg = createFormatRegistry();
    expect(() => reg.require("nope")).toThrow(RangeError);
  });

  it("remove deletes a format", () => {
    const reg = createFormatRegistry();
    expect(reg.remove("sha256")).toBe(true);
    expect(reg.has("sha256")).toBe(false);
    expect(reg.size).toBe(4);
  });

  it("list returns formats sorted by chars", () => {
    const reg = createFormatRegistry();
    reg.register(defineFormat({ name: "tiny", chars: 4, label: "Tiny" }));
    const list = reg.list();
    for (let i = 1; i < list.length; i++) {
      expect(list[i].chars).toBeGreaterThanOrEqual(list[i - 1].chars);
    }
    expect(list[0].name).toBe("tiny");
  });

  it("resolve handles PackFormat, string, number", () => {
    const reg = createFormatRegistry();
    const custom = defineFormat({ name: "x", chars: 10, label: "X" });

    // PackFormat passthrough
    expect(reg.resolve(custom)).toBe(custom);

    // string lookup
    expect(reg.resolve("uuid")).toBe(PACK_FORMATS.uuid);

    // number → anonymous format
    const anon = reg.resolve(12);
    expect(anon.chars).toBe(12);
    expect(anon.bits).toBe(48);
  });

  it("resolve throws for unknown string", () => {
    const reg = createFormatRegistry();
    expect(() => reg.resolve("nope")).toThrow(RangeError);
  });

  it("register overwrites existing name", () => {
    const reg = createFormatRegistry();
    const newUuid = defineFormat({ name: "uuid", chars: 32, label: "Custom UUID" });
    reg.register(newUuid);
    expect(reg.get("uuid")!.label).toBe("Custom UUID");
    expect(reg.size).toBe(5);
  });

  it("empty registry works", () => {
    const reg = new FormatRegistry();
    expect(reg.size).toBe(0);
    expect(reg.list()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  formatHex / parseHex
// ═══════════════════════════════════════════════════════════════════════════

describe("formatHex", () => {
  it("inserts dashes for UUID groups", () => {
    const raw = "abcd0100000000000000000000000042";
    expect(formatHex(PACK_FORMATS.uuid, raw)).toBe("abcd0100-0000-0000-0000-000000000042");
  });

  it("returns unchanged for formats without groups", () => {
    const raw = "abcdef0123456789";
    expect(formatHex(PACK_FORMATS.int64, raw)).toBe(raw);
  });

  it("works with custom groups", () => {
    const fmt = defineFormat({ name: "c", chars: 12, label: "C", groups: [4, 4, 4] });
    expect(formatHex(fmt, "aabbccddeeff")).toBe("aabb-ccdd-eeff");
  });
});

describe("parseHex", () => {
  it("strips dashes and lowercases", () => {
    expect(parseHex("ABCD-0100-0000")).toBe("abcd01000000");
  });

  it("handles no-dash input", () => {
    expect(parseHex("abcdef")).toBe("abcdef");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  hexBoundary
// ═══════════════════════════════════════════════════════════════════════════

describe("hexBoundary", () => {
  it("value=1 → 1 hex char, capacity=16", () => {
    const b = hexBoundary(1);
    expect(b.hexChars).toBe(1);
    expect(b.hexMax).toBe(15);
    expect(b.hexCapacity).toBe(16);
    expect(b.utilization).toBeCloseTo(1 / 16);
  });

  it("value=16 → 1 hex char (maxIndex=15 fits in 1 char)", () => {
    const b = hexBoundary(16);
    expect(b.hexChars).toBe(1);
    expect(b.hexCapacity).toBe(16);
    expect(b.utilization).toBe(1);
  });

  it("value=17 → 2 hex chars", () => {
    const b = hexBoundary(17);
    expect(b.hexChars).toBe(2);
    expect(b.hexMax).toBe(255);
    expect(b.hexCapacity).toBe(256);
  });

  it("value=1000 → 3 hex chars, capacity=4096", () => {
    const b = hexBoundary(1000);
    expect(b.hexChars).toBe(3);
    expect(b.hexMax).toBe(4095);
    expect(b.hexCapacity).toBe(4096);
    expect(b.utilization).toBeCloseTo(1000 / 4096);
    expect(b.nextHexMax).toBe(65535);
  });

  it("value=4096 → 3 hex chars, utilization=1", () => {
    expect(hexBoundary(4096).utilization).toBe(1);
  });

  it("value=4097 → 4 hex chars", () => {
    expect(hexBoundary(4097).hexChars).toBe(4);
  });

  it("clamps value ≤ 0 to 1", () => {
    expect(hexBoundary(0).value).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  hexCeil / hexFloor
// ═══════════════════════════════════════════════════════════════════════════

describe("hexCeil", () => {
  it.each([
    [1, 16], [15, 16], [16, 16],
    [17, 256], [1000, 4096], [4096, 4096], [4097, 65536],
  ])("hexCeil(%d) → %d", (input, expected) => {
    expect(hexCeil(input)).toBe(expected);
  });
});

describe("hexFloor", () => {
  it.each([
    [1, 1], [15, 1], [16, 16],
    [17, 16], [255, 16], [256, 256],
    [1000, 256], [4096, 4096],
  ])("hexFloor(%d) → %d", (input, expected) => {
    expect(hexFloor(input)).toBe(expected);
  });
});

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
