// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import { compose } from "./compose.js";
import { xorObfuscate } from "./xor.js";
import { rotateLeft, rotateRight } from "./rotate.js";
import { reverseBits } from "./reverse.js";

describe("compose", () => {
  it("empty compose is identity", () => {
    const identity = compose();
    expect(identity(42, 8)).toBe(42);
  });

  it("single transform: same as calling directly", () => {
    const enc = compose((id, w) => xorObfuscate(id, w, 0xA3));
    for (let id = 0; id < 256; id++) {
      expect(enc(id, 8)).toBe(xorObfuscate(id, 8, 0xA3));
    }
  });

  it("enc/dec round-trip: rotateLeft(3) → xorObfuscate(0xA3)", () => {
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

  it("triple chain enc/dec: reverseBits → rotateLeft(2) → xorObfuscate(0x55)", () => {
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

  it("self-inverse composed twice = identity", () => {
    const w = 8;
    const double = compose(
      (id, bw) => reverseBits(id, bw),
      (id, bw) => reverseBits(id, bw),
    );
    for (let id = 0; id < 256; id++) {
      expect(double(id, w)).toBe(id);
    }
  });

  it("bijection: composed transform produces distinct values for all IDs", () => {
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
