// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import { toHex, fromHex } from "./hex.js";

describe("toHex (encode)", () => {
  it("bitWidth=8 → 2 hex chars, zero-padded", () => {
    expect(toHex(0, 8)).toBe("00");
    expect(toHex(15, 8)).toBe("0f");
    expect(toHex(255, 8)).toBe("ff");
  });

  it("bitWidth=10 → 3 hex chars", () => {
    expect(toHex(0, 10)).toBe("000");
    expect(toHex(255, 10)).toBe("0ff");
    expect(toHex(1023, 10)).toBe("3ff");
  });

  it("bitWidth=6 → 2 hex chars (ceil(6/4)=2)", () => {
    expect(toHex(0, 6)).toBe("00");
    expect(toHex(63, 6)).toBe("3f");
  });

  it("bitWidth=4 → 1 hex char", () => {
    expect(toHex(0, 4)).toBe("0");
    expect(toHex(15, 4)).toBe("f");
  });

  it("bitWidth=1 → 1 hex char (minimum)", () => {
    expect(toHex(0, 1)).toBe("0");
    expect(toHex(1, 1)).toBe("1");
  });
});

describe("fromHex (decode)", () => {
  it("round-trip: fromHex(toHex(id, w), w) === id (full 10-bit space)", () => {
    const w = 10;
    for (let id = 0; id < 1024; id++) {
      expect(fromHex(toHex(id, w), w)).toBe(id);
    }
  });

  it("round-trip: bitWidth=1 (minimum)", () => {
    expect(fromHex(toHex(0, 1), 1)).toBe(0);
    expect(fromHex(toHex(1, 1), 1)).toBe(1);
  });

  it("accepts uppercase hex", () => {
    expect(fromHex("FF", 8)).toBe(255);
    expect(fromHex("0FF", 10)).toBe(255);
  });

  it("throws RangeError on too-short input", () => {
    expect(() => fromHex("ff", 10)).toThrow(RangeError);
  });

  it("throws RangeError on too-long input", () => {
    expect(() => fromHex("0ffff", 10)).toThrow(RangeError);
  });

  it("throws RangeError on empty string", () => {
    expect(() => fromHex("", 8)).toThrow(RangeError);
  });
});
