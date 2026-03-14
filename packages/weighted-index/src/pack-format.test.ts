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
