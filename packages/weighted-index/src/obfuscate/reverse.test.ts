import { describe, it, expect } from "vitest";
import { reverseBits } from "./reverse.js";

describe("reverseBits (encode = decode)", () => {
  it("0b10110000 reversed (8-bit) → 0b00001101", () => {
    expect(reverseBits(0b10110000, 8)).toBe(0b00001101);
  });

  it("alternating bits: 0b10101010 ↔ 0b01010101", () => {
    expect(reverseBits(0b10101010, 8)).toBe(0b01010101);
    expect(reverseBits(0b01010101, 8)).toBe(0b10101010);
  });

  it("single LSB flips to MSB position", () => {
    expect(reverseBits(0b00000001, 8)).toBe(0b10000000);
    expect(reverseBits(0b0001, 4)).toBe(0b1000);
  });

  it("single MSB flips to LSB position", () => {
    expect(reverseBits(0b10000000, 8)).toBe(0b00000001);
    expect(reverseBits(0b1000, 4)).toBe(0b0001);
  });

  it("palindrome is a fixed point: 0b1001 (4-bit)", () => {
    expect(reverseBits(0b1001, 4)).toBe(0b1001);
  });

  it("4-bit: 0b1010 reversed → 0b0101", () => {
    expect(reverseBits(0b1010, 4)).toBe(0b0101);
  });

  it("0 reversed is always 0", () => {
    expect(reverseBits(0, 8)).toBe(0);
    expect(reverseBits(0, 10)).toBe(0);
  });

  it("all-ones reversed is all-ones", () => {
    expect(reverseBits(0xff, 8)).toBe(0xff);
    expect(reverseBits(0x3ff, 10)).toBe(0x3ff);
  });

  it("self-inverse: applying twice returns original (full 8-bit space)", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(reverseBits(reverseBits(id, w), w)).toBe(id);
    }
  });

  it("bijection: all IDs map to distinct values (8-bit)", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(reverseBits(id, w));
    expect(results.size).toBe(256);
  });
});
