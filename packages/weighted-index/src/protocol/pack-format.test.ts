// @def.boundary weighted-index-system
// @def.doc weighted-index-system

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
