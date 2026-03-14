import { describe, it, expect } from "vitest";
import { calcBitWidth } from "./bit-width.js";

describe("calcBitWidth", () => {
  it("size=1 → 1", () => expect(calcBitWidth(1)).toBe(1));
  it("size=2 → 1", () => expect(calcBitWidth(2)).toBe(1));
  it("size=3 → 2", () => expect(calcBitWidth(3)).toBe(2));
  it("size=4 → 2 (exact power of 2)", () => expect(calcBitWidth(4)).toBe(2));
  it("size=640 → 10", () => expect(calcBitWidth(640)).toBe(10));
  it("size=1024 → 10 (exact power of 2)", () => expect(calcBitWidth(1024)).toBe(10));
  it("size=1025 → 11", () => expect(calcBitWidth(1025)).toBe(11));
  it("size=200 → 8", () => expect(calcBitWidth(200)).toBe(8));
});
