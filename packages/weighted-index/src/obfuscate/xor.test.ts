// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import { xorObfuscate } from "./xor.js";

describe("xorObfuscate", () => {
  it("self-inverse: applying twice returns original (full 8-bit space)", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(xorObfuscate(xorObfuscate(id, w, 0xA3), w, 0xA3)).toBe(id);
    }
  });

  it("key=0 is identity", () => {
    expect(xorObfuscate(65, 8, 0)).toBe(65);
  });

  it("key=all-ones flips all bits (bitwise NOT within bitWidth)", () => {
    expect(xorObfuscate(0b00000000, 8, 0xFF)).toBe(0b11111111);
    expect(xorObfuscate(0b10101010, 8, 0xFF)).toBe(0b01010101);
    expect(xorObfuscate(0b11111111, 8, 0xFF)).toBe(0b00000000);
  });

  it("id=0 with non-zero key produces the key itself (masked to bitWidth)", () => {
    expect(xorObfuscate(0, 8, 0xA3)).toBe(0xA3);
    expect(xorObfuscate(0, 10, 0x2B7)).toBe(0x2B7 & 0x3FF);
  });

  it("key higher than bitWidth is masked — only lower bits applied", () => {
    expect(xorObfuscate(0, 8, 0x1A3)).toBe(xorObfuscate(0, 8, 0xA3));
  });

  it("output stays within bitWidth bits", () => {
    const w = 10;
    const max = (1 << w) - 1;
    for (let id = 0; id <= max; id += 100) {
      expect(xorObfuscate(id, w, 0x2F5)).toBeLessThanOrEqual(max);
    }
  });

  it("bijection: all IDs map to distinct values", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(xorObfuscate(id, w, 0x5C));
    expect(results.size).toBe(256);
  });
});
