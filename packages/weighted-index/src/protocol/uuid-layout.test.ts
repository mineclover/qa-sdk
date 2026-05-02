// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import { createUUIDLayout, packUUID, unpackUUID, charsForMax, planLayout } from "./uuid-layout.js";

const schema = createUUIDLayout({
  left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  right: [{ name: "index",  chars: 6 }],
});

describe("createUUIDLayout", () => {
  it("computes left field positions from char 0 rightward", () => {
    expect(schema.left).toEqual([
      { name: "prefix",  chars: 4, start: 0 },
      { name: "version", chars: 2, start: 4 },
    ]);
  });

  it("computes right field positions from char 31 leftward", () => {
    expect(schema.right).toEqual([
      { name: "index", chars: 6, start: 26 },
    ]);
  });

  it("tracks totals", () => {
    expect(schema.totalLeft).toBe(6);
    expect(schema.totalRight).toBe(6);
  });

  it("throws when left + right exceed 32 chars", () => {
    expect(() => createUUIDLayout({
      left:  [{ name: "a", chars: 20 }],
      right: [{ name: "b", chars: 13 }],
    })).toThrow(RangeError);
  });

  it("accepts layout that fills all 32 chars", () => {
    const full = createUUIDLayout({
      left:  [{ name: "a", chars: 16 }],
      right: [{ name: "b", chars: 16 }],
    });
    expect(full.totalLeft + full.totalRight).toBe(32);
  });
});

describe("packUUID", () => {
  it("places left fields at front, right fields at end, zero-fills gap", () => {
    const uuid = packUUID(schema, { prefix: 0xABCD, version: 1, index: 42 });
    // prefix "abcd" at 0-3, version "01" at 4-5, gap 6-25 = zeros, index "00002a" at 26-31
    expect(uuid).toBe("abcd0100-0000-0000-0000-00000000002a");
  });

  it("handles max values per field", () => {
    const uuid = packUUID(schema, { prefix: 0xFFFF, version: 0xFF, index: 0xFFFFFF });
    // prefix "ffff" at 0-3, version "ff" at 4-5, gap zeros, index "ffffff" at 26-31
    expect(uuid).toBe("ffffff00-0000-0000-0000-000000ffffff");
  });

  it("missing values default to 0", () => {
    const uuid = packUUID(schema, { prefix: 1 });
    expect(uuid).toBe("00010000-0000-0000-0000-000000000000");
  });

  it("output is always 8-4-4-4-12 UUID format", () => {
    const uuid = packUUID(schema, { prefix: 0, version: 0, index: 0 });
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("unpackUUID", () => {
  it("round-trip: unpack(pack(values)) === values", () => {
    const values = { prefix: 0xABCD, version: 1, index: 42 };
    expect(unpackUUID(schema, packUUID(schema, values))).toEqual(values);
  });

  it("round-trip with max values", () => {
    const values = { prefix: 0xFFFF, version: 0xFF, index: 0xFFFFFF };
    expect(unpackUUID(schema, packUUID(schema, values))).toEqual(values);
  });

  it("round-trip with all zeros", () => {
    const values = { prefix: 0, version: 0, index: 0 };
    expect(unpackUUID(schema, packUUID(schema, values))).toEqual(values);
  });

  it("accepts uppercase input", () => {
    const uuid = "ABCD0100-0000-0000-0000-00000000002A";
    expect(unpackUUID(schema, uuid)).toEqual({ prefix: 0xABCD, version: 1, index: 42 });
  });
});

describe("various layouts", () => {
  it("left-only layout", () => {
    const s = createUUIDLayout({
      left:  [{ name: "id", chars: 8 }],
      right: [],
    });
    const uuid = packUUID(s, { id: 0xDEADBEEF });
    expect(uuid).toBe("deadbeef-0000-0000-0000-000000000000");
    expect(unpackUUID(s, uuid)).toEqual({ id: 0xDEADBEEF });
  });

  it("right-only layout", () => {
    const s = createUUIDLayout({
      left:  [],
      right: [{ name: "id", chars: 8 }],
    });
    const uuid = packUUID(s, { id: 0xCAFEBABE });
    expect(uuid).toBe("00000000-0000-0000-0000-0000cafebabe");
    expect(unpackUUID(s, uuid)).toEqual({ id: 0xCAFEBABE });
  });

  it("multiple right fields pack from the end inward", () => {
    const s = createUUIDLayout({
      left:  [{ name: "type", chars: 2 }],
      right: [{ name: "seq", chars: 4 }, { name: "id", chars: 6 }],
    });
    // right order: seq is outermost (chars 28-31), id is next inward (chars 22-27)
    const uuid = packUUID(s, { type: 0x0A, seq: 0x0001, id: 42 });
    const unpacked = unpackUUID(s, uuid);
    expect(unpacked).toEqual({ type: 0x0A, seq: 0x0001, id: 42 });
  });

  it("full 32-char layout with no gap", () => {
    const s = createUUIDLayout({
      left:  [{ name: "a", chars: 8 }, { name: "b", chars: 8 }],
      right: [{ name: "c", chars: 8 }, { name: "d", chars: 8 }],
    });
    const uuid = packUUID(s, { a: 1, b: 2, c: 3, d: 4 });
    const unpacked = unpackUUID(s, uuid);
    expect(unpacked).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });
});

describe("charsForMax", () => {
  it("returns 1 for maxValue 0..15", () => {
    expect(charsForMax(0)).toBe(1);
    expect(charsForMax(1)).toBe(1);
    expect(charsForMax(15)).toBe(1);
  });
  it("returns 2 for 16..255", () => {
    expect(charsForMax(16)).toBe(2);
    expect(charsForMax(255)).toBe(2);
  });
  it("returns 3 for 256..4095", () => {
    expect(charsForMax(256)).toBe(3);
    expect(charsForMax(639)).toBe(3);
    expect(charsForMax(4095)).toBe(3);
  });
  it("returns 8 for 2^30-1", () => {
    expect(charsForMax((1 << 30) - 1)).toBe(8);
  });
});

describe("planLayout", () => {
  it("auto-computes chars from maxValue", () => {
    const plan = planLayout({
      left:  [{ name: "prefix", chars: 4 }, { name: "version", maxValue: 15 }],
      right: [{ name: "index", maxValue: 639 }],
    });
    expect(plan.fields).toEqual([
      { name: "prefix",  chars: 4, maxValue: 0xFFFF, side: "left" },
      { name: "version", chars: 1, maxValue: 15,     side: "left" },
      { name: "index",   chars: 3, maxValue: 639,    side: "right" },
    ]);
    expect(plan.totalChars).toBe(8);
    expect(plan.fitsUUID).toBe(true);
    expect(plan.gap).toBe(24);
    expect(plan.layout).toBeDefined();
  });

  it("layout from plan is usable with packUUID/unpackUUID", () => {
    const plan = planLayout({
      left:  [{ name: "prefix", chars: 4 }, { name: "version", maxValue: 15 }],
      right: [{ name: "index", maxValue: 639 }],
    });
    const uuid = packUUID(plan.layout!, { prefix: 0xABCD, version: 3, index: 42 });
    expect(unpackUUID(plan.layout!, uuid)).toEqual({ prefix: 0xABCD, version: 3, index: 42 });
  });

  it("fitsUUID = false when total exceeds 32", () => {
    const plan = planLayout({
      left:  [{ name: "a", chars: 20 }],
      right: [{ name: "b", chars: 20 }],
    });
    expect(plan.fitsUUID).toBe(false);
    expect(plan.totalChars).toBe(40);
    expect(plan.layout).toBeUndefined();
  });

  it("shape [8,4,5,4] → index needs 3 chars, fits UUID easily", () => {
    const size = 8 * 4 * 5 * 4; // 640
    const plan = planLayout({
      left:  [{ name: "prefix", chars: 4 }, { name: "version", maxValue: 7 }],
      right: [{ name: "index", maxValue: size - 1 }],
    });
    expect(plan.fields.find(f => f.name === "index")!.chars).toBe(3);
    expect(plan.totalChars).toBe(8); // 4 + 1 + 3
    expect(plan.fitsUUID).toBe(true);
  });

  it("large shape warns when it doesn't fit", () => {
    // Contrived: 16^33 values would need 33 chars
    const plan = planLayout({
      left:  [{ name: "prefix", chars: 16 }],
      right: [{ name: "index", chars: 17 }],
    });
    expect(plan.fitsUUID).toBe(false);
    expect(plan.totalChars).toBe(33);
  });
});
