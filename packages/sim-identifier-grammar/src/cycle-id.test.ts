import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { decodeTime } from "ulid";
import { buildCycleId, parseCycleId, type CycleId } from "./cycle-id.js";

describe("cycle id grammar (#8)", () => {
  it("builds a 26-char ULID", () => {
    const out = buildCycleId({ controllerId: "CTRL0001", cycleAt: 1714291200000 });
    expect(out).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("encodes cycleAt into ULID timestamp segment (decodeTime roundtrip)", () => {
    const cycleAt = 1714291200000;
    const id = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    expect(decodeTime(id)).toBe(cycleAt);
  });

  it("produces different randomness for the same cycleAt", () => {
    const cycleAt = 1714291200000;
    const a = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    const b = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    expect(a).not.toBe(b);
    expect(decodeTime(a)).toBe(decodeTime(b));
  });

  it("parses back to cycleAt + randomness segments", () => {
    const cycleAt = 1714291200000;
    const id = buildCycleId({ controllerId: "CTRL0002", cycleAt });
    const parsed = parseCycleId(id);
    expect(parsed.cycleAt).toBe(cycleAt);
    expect(parsed.randomness).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  it("rejects non-ULID strings", () => {
    expect(() => parseCycleId("not-a-ulid")).toThrow();
    expect(() => parseCycleId("01HVZABCDEFGHJKMNPQRSTVWX")).toThrow(); // 25 chars
  });

  it("rejects negative or non-finite cycleAt", () => {
    expect(() => buildCycleId({ controllerId: "CTRL0001", cycleAt: -1 })).toThrow();
    expect(() => buildCycleId({ controllerId: "CTRL0001", cycleAt: Number.NaN })).toThrow();
  });

  it("roundtrip property over varied timestamps", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 281_474_976_710_655 }), // ULID 48bit max
        (cycleAt) => {
          const id = buildCycleId({ controllerId: "CTRL0001", cycleAt });
          const parsed = parseCycleId(id);
          expect(parsed.cycleAt).toBe(cycleAt);
        },
      ),
      { numRuns: 200 },
    );
  });
});
