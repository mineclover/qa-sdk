import { describe, it, expect } from "vitest";
import { WeightedIndex } from "../math/weighted-index.js";
import { calcBitWidth } from "./bit-width.js";
import { xorObfuscate } from "./xor.js";
import { rotateLeft, rotateRight } from "./rotate.js";
import { compose } from "./compose.js";
import { toHex, fromHex } from "./hex.js";
import { toUUID, fromUUID } from "./uuid.js";

describe("obfuscate + WeightedIndex integration", () => {
  const wi = new WeightedIndex([8, 4, 5, 4]); // size = 640
  const w = calcBitWidth(wi.size);            // 10

  it("calcBitWidth(wi.size) fits all valid IDs", () => {
    expect(wi.size - 1).toBeLessThanOrEqual((1 << w) - 1);
  });

  it("obfuscated value may exceed wi.size-1 — valid token, out-of-range ID", () => {
    // size=640, bitWidth=10 → tokens can be [0, 1023]; [640, 1023] are valid tokens
    const key = 0x3FF;
    const outOfRange = Array.from({ length: wi.size }, (_, id) => xorObfuscate(id, w, key))
      .filter(obf => obf >= wi.size);
    expect(outOfRange.length).toBeGreaterThan(0);
  });

  it("no two distinct IDs produce the same obfuscated hex", () => {
    const key = 0x2B7;
    const hexSet = new Set<string>();
    for (let id = 0; id < wi.size; id++) {
      hexSet.add(toHex(xorObfuscate(id, w, key), w));
    }
    expect(hexSet.size).toBe(wi.size);
  });

  it("UUID round-trip for all valid IDs", () => {
    for (let id = 0; id < wi.size; id++) {
      const obf = rotateLeft(xorObfuscate(id, w, 0x1F3), w, 3);
      expect(fromUUID(toUUID(obf, w), w)).toBe(obf);
    }
  });

  it("full pipeline: coords → encode → obfuscate → UUID → deobfuscate → decode → coords", () => {
    const key = 0x2B7;
    const amount = 3;
    const enc = compose(
      (id, bw) => xorObfuscate(id, bw, key),
      (id, bw) => rotateLeft(id, bw, amount),
    );
    const dec = compose(
      (id, bw) => rotateRight(id, bw, amount),
      (id, bw) => xorObfuscate(id, bw, key),
    );

    const coords: [number, number, number, number][] = [
      [1, 1, 1, 1], [8, 4, 5, 4], [3, 2, 4, 1], [5, 3, 2, 3],
    ];
    for (const c of coords) {
      const id = wi.encode(c);
      const uuid = toUUID(enc(id, w), w);
      expect(wi.decode(dec(fromUUID(uuid, w), w))).toEqual(c);
    }
  });
});
