import { describe, it, expect } from "vitest";
import {
  calcBitWidth,
  xorObfuscate,
  rotateLeft,
  rotateRight,
  reverseBits,
  compose,
  toHex,
  fromHex,
  toUUID,
  fromUUID,
} from "./obfuscate.js";
import { WeightedIndex } from "./weighted-index.js";

// ── calcBitWidth ──────────────────────────────────────────────────────────────

describe("calcBitWidth", () => {
  it("size=1 → 1", () => expect(calcBitWidth(1)).toBe(1));
  it("size=2 → 1", () => expect(calcBitWidth(2)).toBe(1));
  it("size=3 → 2", () => expect(calcBitWidth(3)).toBe(2));
  it("size=640 → 10", () => expect(calcBitWidth(640)).toBe(10));
  it("size=1024 → 10", () => expect(calcBitWidth(1024)).toBe(10));
  it("size=1025 → 11", () => expect(calcBitWidth(1025)).toBe(11));
  it("size=200 → 8", () => expect(calcBitWidth(200)).toBe(8));
});

// ── xorObfuscate ──────────────────────────────────────────────────────────────

describe("xorObfuscate", () => {
  it("self-inverse: applying twice returns original", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(xorObfuscate(xorObfuscate(id, w, 0xA3), w, 0xA3)).toBe(id);
    }
  });

  it("key=0 is identity transform", () => {
    expect(xorObfuscate(65, 8, 0)).toBe(65);
  });

  it("key=all-ones flips all bits (NOT operation)", () => {
    expect(xorObfuscate(0b00000000, 8, 0xFF)).toBe(0b11111111);
    expect(xorObfuscate(0b10101010, 8, 0xFF)).toBe(0b01010101);
    expect(xorObfuscate(0b11111111, 8, 0xFF)).toBe(0b00000000);
  });

  it("id=0 with non-zero key produces the key itself (masked)", () => {
    expect(xorObfuscate(0, 8, 0xA3)).toBe(0xA3);
    expect(xorObfuscate(0, 10, 0x2B7)).toBe(0x2B7 & 0x3FF);
  });

  it("output stays within bitWidth bits", () => {
    const w = 10;
    const max = (1 << w) - 1;
    for (let id = 0; id <= max; id += 100) {
      expect(xorObfuscate(id, w, 0x2F5)).toBeLessThanOrEqual(max);
    }
  });

  it("key higher than bitWidth is masked", () => {
    // key=0x1A3 for bitWidth=8: effective key = 0xA3
    expect(xorObfuscate(0, 8, 0x1A3)).toBe(xorObfuscate(0, 8, 0xA3));
  });

  it("bijection: all IDs map to distinct obfuscated values", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(xorObfuscate(id, w, 0x5C));
    expect(results.size).toBe(256);
  });
});

// ── rotateLeft / rotateRight ──────────────────────────────────────────────────

describe("rotateLeft", () => {
  it("basic rotation: 0b00000001 left 1 → 0b00000010", () => {
    expect(rotateLeft(0b00000001, 8, 1)).toBe(0b00000010);
  });

  it("wrap-around: MSB rotates to LSB", () => {
    expect(rotateLeft(0b10000000, 8, 1)).toBe(0b00000001);
  });

  it("multi-bit MSBs wrap correctly: 0b11000000 left 2 → 0b00000011", () => {
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

  it("amount > bitWidth wraps via modulo", () => {
    // rotateLeft(id, 8, 9) === rotateLeft(id, 8, 1)
    const id = 0b10110101;
    expect(rotateLeft(id, 8, 9)).toBe(rotateLeft(id, 8, 1));
    expect(rotateLeft(id, 8, 17)).toBe(rotateLeft(id, 8, 1));
  });

  it("amount=bitWidth-1: one step before full cycle", () => {
    // rotateLeft(id, 8, 7) === rotateRight(id, 8, 1)
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

describe("rotateRight", () => {
  it("basic rotation: 0b00000010 right 1 → 0b00000001", () => {
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

  it("amount > bitWidth wraps via modulo", () => {
    const id = 0b10110101;
    expect(rotateRight(id, 8, 9)).toBe(rotateRight(id, 8, 1));
  });

  it("bijection: all IDs map to distinct values (8-bit, amount=5)", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(rotateRight(id, w, 5));
    expect(results.size).toBe(256);
  });
});

describe("rotateLeft / rotateRight inverse", () => {
  it("rotateRight reverses rotateLeft for all ids (8-bit)", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(rotateRight(rotateLeft(id, w, 3), w, 3)).toBe(id);
    }
  });

  it("rotateLeft reverses rotateRight", () => {
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

// ── reverseBits ───────────────────────────────────────────────────────────────

describe("reverseBits", () => {
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

  it("palindrome pattern is self-fixed-point: 0b1001 (4-bit)", () => {
    expect(reverseBits(0b1001, 4)).toBe(0b1001);
  });

  it("4-bit width: 0b1010 reversed → 0b0101", () => {
    expect(reverseBits(0b1010, 4)).toBe(0b0101);
  });

  it("self-inverse: applying twice returns original", () => {
    const w = 8;
    for (let id = 0; id < 256; id++) {
      expect(reverseBits(reverseBits(id, w), w)).toBe(id);
    }
  });

  it("0 reversed is always 0", () => {
    expect(reverseBits(0, 8)).toBe(0);
    expect(reverseBits(0, 10)).toBe(0);
  });

  it("all-ones reversed is all-ones", () => {
    expect(reverseBits(0xff, 8)).toBe(0xff);
    expect(reverseBits(0x3ff, 10)).toBe(0x3ff);
  });

  it("bijection: all IDs map to distinct values (8-bit)", () => {
    const w = 8;
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(reverseBits(id, w));
    expect(results.size).toBe(256);
  });
});

// ── compose ───────────────────────────────────────────────────────────────────

describe("compose", () => {
  it("single transform: same as calling directly", () => {
    const enc = compose((id, w) => xorObfuscate(id, w, 0xA3));
    for (let id = 0; id < 256; id++) {
      expect(enc(id, 8)).toBe(xorObfuscate(id, 8, 0xA3));
    }
  });

  it("enc + dec round-trip: rotateLeft(3) → xorObfuscate(0xA3)", () => {
    const w = 8;
    const enc = compose(
      (id, bw) => rotateLeft(id, bw, 3),
      (id, bw) => xorObfuscate(id, bw, 0xA3),
    );
    const dec = compose(
      (id, bw) => xorObfuscate(id, bw, 0xA3),
      (id, bw) => rotateRight(id, bw, 3),
    );
    for (let id = 0; id < 256; id++) {
      expect(dec(enc(id, w), w)).toBe(id);
    }
  });

  it("triple chain: reverseBits → rotateLeft(2) → xorObfuscate(0x55)", () => {
    const w = 8;
    const enc = compose(
      (id, bw) => reverseBits(id, bw),
      (id, bw) => rotateLeft(id, bw, 2),
      (id, bw) => xorObfuscate(id, bw, 0x55),
    );
    const dec = compose(
      (id, bw) => xorObfuscate(id, bw, 0x55),
      (id, bw) => rotateRight(id, bw, 2),
      (id, bw) => reverseBits(id, bw),
    );
    for (let id = 0; id < 256; id++) {
      expect(dec(enc(id, w), w)).toBe(id);
    }
  });

  it("empty compose is identity", () => {
    const identity = compose();
    expect(identity(42, 8)).toBe(42);
  });

  it("bijection: composed transform maps all IDs to distinct values", () => {
    const w = 8;
    const enc = compose(
      (id, bw) => rotateLeft(id, bw, 3),
      (id, bw) => xorObfuscate(id, bw, 0xA3),
      (id, bw) => reverseBits(id, bw),
    );
    const results = new Set<number>();
    for (let id = 0; id < 256; id++) results.add(enc(id, w));
    expect(results.size).toBe(256);
  });
});

// ── toHex / fromHex ───────────────────────────────────────────────────────────

describe("toHex / fromHex", () => {
  it("bitWidth=8 → 2 hex chars, zero-padded", () => {
    expect(toHex(0, 8)).toBe("00");
    expect(toHex(255, 8)).toBe("ff");
    expect(toHex(15, 8)).toBe("0f");
  });

  it("bitWidth=10 → 3 hex chars", () => {
    expect(toHex(0, 10)).toBe("000");
    expect(toHex(255, 10)).toBe("0ff");
    expect(toHex(1023, 10)).toBe("3ff");
  });

  it("round-trip: fromHex(toHex(id)) === id", () => {
    const w = 10;
    for (let id = 0; id < 1024; id++) {
      expect(fromHex(toHex(id, w), w)).toBe(id);
    }
  });

  it("fromHex throws on wrong length", () => {
    expect(() => fromHex("ff", 10)).toThrow(RangeError);
    expect(() => fromHex("0ffff", 10)).toThrow(RangeError);
  });
});

// ── toUUID / fromUUID ─────────────────────────────────────────────────────────

describe("toUUID / fromUUID", () => {
  it("output matches 8-4-4-4-12 format", () => {
    const uuid = toUUID(12345, 10);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("small id pads to full UUID", () => {
    expect(toUUID(0, 8)).toBe("00000000-0000-0000-0000-000000000000");
    expect(toUUID(1, 8)).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("round-trip: fromUUID(toUUID(id)) === id", () => {
    const ids = [0, 1, 255, 1023, 65535, 12345678];
    for (const id of ids) {
      expect(fromUUID(toUUID(id, calcBitWidth(id + 1)))).toBe(id);
    }
  });
});

// ── WeightedIndex integration ─────────────────────────────────────────────────

describe("obfuscate + WeightedIndex integration", () => {
  const wi = new WeightedIndex([8, 4, 5, 4]); // size = 640
  const w = calcBitWidth(wi.size);            // 10

  it("calcBitWidth(wi.size) fits all valid IDs", () => {
    const max = (1 << w) - 1;
    expect(wi.size - 1).toBeLessThanOrEqual(max);
  });

  it("enc/dec round-trip preserves all encoded IDs", () => {
    const key = 0x2B7;
    for (let id = 0; id < wi.size; id++) {
      const obf = xorObfuscate(id, w, key);
      expect(xorObfuscate(obf, w, key)).toBe(id);
    }
  });

  it("no two distinct IDs produce the same obfuscated hex", () => {
    const key = 0x2B7;
    const hexSet = new Set<string>();
    for (let id = 0; id < wi.size; id++) {
      hexSet.add(toHex(xorObfuscate(id, w, key), w));
    }
    expect(hexSet.size).toBe(wi.size);
  });

  it("decode(obf) → coords via composed transform", () => {
    const enc = compose(
      (id, bw) => rotateLeft(id, bw, 3),
      (id, bw) => xorObfuscate(id, bw, 0xC1),
    );
    const dec = compose(
      (id, bw) => xorObfuscate(id, bw, 0xC1),
      (id, bw) => rotateRight(id, bw, 3),
    );

    const original = wi.encode([3, 2, 4, 1]);
    const token = toHex(enc(original, w), w);
    const recovered = wi.decode(dec(fromHex(token, w), w));
    expect(recovered).toEqual([3, 2, 4, 1]);
  });
});
