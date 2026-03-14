import { describe, it, expect } from "vitest";
import { rotateLeft, rotateRight } from "./rotate.js";

describe("rotateLeft (encode)", () => {
  it("basic: 0b00000001 left 1 → 0b00000010", () => {
    expect(rotateLeft(0b00000001, 8, 1)).toBe(0b00000010);
  });

  it("wrap-around: MSB rotates to LSB", () => {
    expect(rotateLeft(0b10000000, 8, 1)).toBe(0b00000001);
  });

  it("multi-bit MSBs wrap: 0b11000000 left 2 → 0b00000011", () => {
    expect(rotateLeft(0b11000000, 8, 2)).toBe(0b00000011);
  });

  it("mixed bits: 0b10000001 left 1 → 0b00000011", () => {
    expect(rotateLeft(0b10000001, 8, 1)).toBe(0b00000011);
  });

  it("amount=0 is identity", () => {
    expect(rotateLeft(0b10110101, 8, 0)).toBe(0b10110101);
  });

  it("amount=bitWidth is identity (full cycle)", () => {
    expect(rotateLeft(0b10110101, 8, 8)).toBe(0b10110101);
  });

  it("amount > bitWidth reduces via modulo", () => {
    const id = 0b10110101;
    expect(rotateLeft(id, 8, 9)).toBe(rotateLeft(id, 8, 1));
    expect(rotateLeft(id, 8, 17)).toBe(rotateLeft(id, 8, 1));
  });

  it("amount=bitWidth-1 equals rotateRight(1)", () => {
    const id = 0b10110101;
    expect(rotateLeft(id, 8, 7)).toBe(rotateRight(id, 8, 1));
  });

  it("additive property: rotateLeft(k1) then rotateLeft(k2) = rotateLeft(k1+k2)", () => {
    const w = 8;
    const id = 0b10110011;
    expect(rotateLeft(rotateLeft(id, w, 2), w, 3)).toBe(rotateLeft(id, w, 5));
  });

  it("output stays within bitWidth bits", () => {
    const w = 10;
    const max = (1 << w) - 1;
    for (let id = 0; id <= max; id += 50) {
      expect(rotateLeft(id, w, 3)).toBeLessThanOrEqual(max);
    }
  });
});

describe("rotateRight (decode)", () => {
  it("basic: 0b00000010 right 1 → 0b00000001", () => {
    expect(rotateRight(0b00000010, 8, 1)).toBe(0b00000001);
  });

  it("wrap-around: LSB rotates to MSB", () => {
    expect(rotateRight(0b00000001, 8, 1)).toBe(0b10000000);
  });

  it("multi-bit LSBs wrap: 0b00000011 right 2 → 0b11000000", () => {
    expect(rotateRight(0b00000011, 8, 2)).toBe(0b11000000);
  });

  it("amount=0 is identity", () => {
    expect(rotateRight(0b10110101, 8, 0)).toBe(0b10110101);
  });

  it("amount=bitWidth is identity (full cycle)", () => {
    expect(rotateRight(0b10110101, 8, 8)).toBe(0b10110101);
  });

  it("amount > bitWidth reduces via modulo", () => {
    const id = 0b10110101;
    expect(rotateRight(id, 8, 9)).toBe(rotateRight(id, 8, 1));
  });

  it("negative amount treated as equivalent positive rotation", () => {
    const w = 8, id = 0b10110101;
    expect(rotateLeft(id, w, -1)).toBe(rotateLeft(id, w, 7));   // -1 mod 8 = 7
    expect(rotateRight(id, w, -3)).toBe(rotateRight(id, w, 5)); // -3 mod 8 = 5
  });

  it("bijection: all IDs map to distinct values (8-bit, amount=5)", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(rotateRight(id, w, 5));
    expect(results.size).toBe(256);
  });
});

describe("rotateLeft / rotateRight — inverse pair", () => {
  it("rotateRight reverses rotateLeft (full 8-bit space)", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(rotateRight(rotateLeft(id, w, 3), w, 3)).toBe(id);
    }
  });

  it("rotateLeft reverses rotateRight (full 8-bit space)", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(rotateLeft(rotateRight(id, w, 5), w, 5)).toBe(id);
    }
  });

  it("rotateLeft(k) + rotateLeft(w-k) = identity", () => {
    const w = 8;
    const id = 0b10110011;
    expect(rotateLeft(rotateLeft(id, w, 3), w, w - 3)).toBe(id);
  });

  it("bijection: all IDs map to distinct values (10-bit, amount=3)", () => {
    const w = 10;
    const size = 1 << w;
    const results = new Set<number>();
    for (let id = 0; id < size; id++) results.add(rotateLeft(id, w, 3));
    expect(results.size).toBe(size);
  });
});
