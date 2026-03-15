import { describe, it, expect } from "vitest";
import {
  createMask, setBit, clearBit, hasBit,
  buildMask, hasAnyBit, hasAllBits, popcount,
  maskAnd, maskOr, masksOverlap,
} from "./bitmask.js";
import { WeightedIndex } from "./weighted-index.js";

// ── createMask ─────────────────────────────────────────────────────────────

describe("createMask", () => {
  it("size=8 → 1 byte", () => expect(createMask(8).length).toBe(1));
  it("size=9 → 2 bytes (ceiling)", () => expect(createMask(9).length).toBe(2));
  it("size=640 → 80 bytes", () => expect(createMask(640).length).toBe(80));
  it("all bytes are zero", () => {
    const m = createMask(64);
    expect([...m].every((b) => b === 0)).toBe(true);
  });
});

// ── setBit / clearBit / hasBit ─────────────────────────────────────────────

describe("setBit / hasBit / clearBit", () => {
  it("newly created mask has no bits set", () => {
    const m = createMask(64);
    for (let i = 0; i < 64; i++) expect(hasBit(m, i)).toBe(false);
  });

  it("set then test returns true", () => {
    const m = createMask(64);
    setBit(m, 7);
    expect(hasBit(m, 7)).toBe(true);
  });

  it("set does not affect neighbouring bits", () => {
    const m = createMask(64);
    setBit(m, 7);
    expect(hasBit(m, 6)).toBe(false);
    expect(hasBit(m, 8)).toBe(false);
  });

  it("clear after set returns false", () => {
    const m = createMask(64);
    setBit(m, 42);
    clearBit(m, 42);
    expect(hasBit(m, 42)).toBe(false);
  });

  it("clear without prior set is a no-op", () => {
    const m = createMask(64);
    clearBit(m, 10);
    expect(hasBit(m, 10)).toBe(false);
  });

  it("bit 0 and bit 639 work at boundaries", () => {
    const m = createMask(640);
    setBit(m, 0);
    setBit(m, 639);
    expect(hasBit(m, 0)).toBe(true);
    expect(hasBit(m, 639)).toBe(true);
    expect(hasBit(m, 1)).toBe(false);
    expect(hasBit(m, 638)).toBe(false);
  });

  it("bit address formula: byte = id >> 3, bit = id & 7", () => {
    const m = createMask(64);
    setBit(m, 17); // byte 2, bit 1 → 0b00000010 = 2
    expect(m[2]).toBe(0b00000010);
  });

  // ── bounds checking ────────────────────────────────────────────────

  describe("bounds checking", () => {
    it("negative id throws RangeError on setBit", () => {
      const m = createMask(64);
      expect(() => setBit(m, -1)).toThrow(RangeError);
    });

    it("negative id throws RangeError on clearBit", () => {
      const m = createMask(64);
      expect(() => clearBit(m, -1)).toThrow(RangeError);
    });

    it("negative id throws RangeError on hasBit", () => {
      const m = createMask(64);
      expect(() => hasBit(m, -1)).toThrow(RangeError);
    });

    it("id >= mask.length * 8 throws RangeError on setBit", () => {
      const m = createMask(64); // 8 bytes, max valid id = 63
      expect(() => setBit(m, 64)).toThrow(RangeError);
    });

    it("id >= mask.length * 8 throws RangeError on clearBit", () => {
      const m = createMask(64);
      expect(() => clearBit(m, 64)).toThrow(RangeError);
    });

    it("id >= mask.length * 8 throws RangeError on hasBit", () => {
      const m = createMask(64);
      expect(() => hasBit(m, 64)).toThrow(RangeError);
    });

    it("id at boundary (mask.length * 8 - 1) succeeds", () => {
      const m = createMask(64); // max valid = 63
      setBit(m, 63);
      expect(hasBit(m, 63)).toBe(true);
      clearBit(m, 63);
      expect(hasBit(m, 63)).toBe(false);
    });

    it("id === 0 succeeds", () => {
      const m = createMask(64);
      setBit(m, 0);
      expect(hasBit(m, 0)).toBe(true);
      clearBit(m, 0);
      expect(hasBit(m, 0)).toBe(false);
    });
  });
});

// ── buildMask ─────────────────────────────────────────────────────────────

describe("buildMask", () => {
  it("builds mask from array of ids", () => {
    const m = buildMask(64, [0, 7, 63]);
    expect(hasBit(m, 0)).toBe(true);
    expect(hasBit(m, 7)).toBe(true);
    expect(hasBit(m, 63)).toBe(true);
    expect(hasBit(m, 1)).toBe(false);
  });

  it("empty iterable → all-zero mask", () => {
    const m = buildMask(64, []);
    expect([...m].every((b) => b === 0)).toBe(true);
  });

  it("duplicate ids are idempotent", () => {
    const m = buildMask(64, [5, 5, 5]);
    expect(hasBit(m, 5)).toBe(true);
    expect(popcount(m)).toBe(1);
  });
});

// ── hasAnyBit / hasAllBits ────────────────────────────────────────────────

describe("hasAnyBit", () => {
  it("returns true when at least one id is set", () => {
    const m = buildMask(64, [10, 20]);
    expect(hasAnyBit(m, [5, 10, 30])).toBe(true);
  });

  it("returns false when no id is set", () => {
    const m = buildMask(64, [10, 20]);
    expect(hasAnyBit(m, [5, 15, 30])).toBe(false);
  });

  it("empty iterable → false", () => {
    const m = buildMask(64, [1, 2, 3]);
    expect(hasAnyBit(m, [])).toBe(false);
  });
});

describe("hasAllBits", () => {
  it("returns true when all ids are set", () => {
    const m = buildMask(64, [1, 2, 3]);
    expect(hasAllBits(m, [1, 2, 3])).toBe(true);
  });

  it("returns false when any id is missing", () => {
    const m = buildMask(64, [1, 2]);
    expect(hasAllBits(m, [1, 2, 3])).toBe(false);
  });

  it("empty iterable → vacuously true", () => {
    const m = createMask(64);
    expect(hasAllBits(m, [])).toBe(true);
  });
});

// ── popcount ──────────────────────────────────────────────────────────────

describe("popcount", () => {
  it("zero mask → 0", () => expect(popcount(createMask(64))).toBe(0));

  it("single bit → 1", () => {
    const m = createMask(64);
    setBit(m, 33);
    expect(popcount(m)).toBe(1);
  });

  it("N bits set → N", () => {
    const ids = [0, 7, 15, 31, 42, 63];
    expect(popcount(buildMask(64, ids))).toBe(ids.length);
  });

  it("full byte → 8", () => {
    const m = new Uint8Array([0xff]);
    expect(popcount(m)).toBe(8);
  });
});

// ── mask algebra ──────────────────────────────────────────────────────────

describe("maskAnd", () => {
  it("intersection contains only shared bits", () => {
    const a = buildMask(16, [1, 2, 3]);
    const b = buildMask(16, [2, 3, 4]);
    const c = maskAnd(a, b);
    expect(hasBit(c, 1)).toBe(false);
    expect(hasBit(c, 2)).toBe(true);
    expect(hasBit(c, 3)).toBe(true);
    expect(hasBit(c, 4)).toBe(false);
  });
});

describe("maskOr", () => {
  it("union contains all bits from both", () => {
    const a = buildMask(16, [1, 2]);
    const b = buildMask(16, [3, 4]);
    const c = maskOr(a, b);
    expect([1, 2, 3, 4].every((id) => hasBit(c, id))).toBe(true);
  });
});

describe("masksOverlap", () => {
  it("true when masks share a bit", () => {
    const a = buildMask(16, [5]);
    const b = buildMask(16, [5, 10]);
    expect(masksOverlap(a, b)).toBe(true);
  });

  it("false when masks are disjoint", () => {
    const a = buildMask(16, [1, 2]);
    const b = buildMask(16, [3, 4]);
    expect(masksOverlap(a, b)).toBe(false);
  });

  it("false when both masks are all-zero", () => {
    const a = createMask(64);
    const b = createMask(64);
    expect(masksOverlap(a, b)).toBe(false);
  });
});

// ── maskOr integration ─────────────────────────────────────────────────────

describe("maskOr + popcount integration", () => {
  it("union of two disjoint masks has popcount = sum of each", () => {
    const a = buildMask(64, [0, 1, 2]);
    const b = buildMask(64, [10, 20, 30]);
    const u = maskOr(a, b);
    expect(popcount(u)).toBe(popcount(a) + popcount(b));
  });
});

// ── WeightedIndex integration ─────────────────────────────────────────────

describe("bitmask + WeightedIndex integration", () => {
  // 4D permission model: resource×action×role×env  (mirrors the explorer demo)
  const wi = new WeightedIndex([8, 4, 5, 4]);   // shape used in web app v1
  const SIZE = wi.size;                          // 640

  it("createMask(wi.size) has correct byte length", () => {
    expect(createMask(SIZE).length).toBe(80);   // ceil(640/8)
  });

  it("setBit + hasBit round-trip for encoded IDs", () => {
    const mask = createMask(SIZE);
    const coords: Array<[number, number, number, number]> = [
      [1, 1, 1, 1],
      [8, 4, 5, 4],
      [3, 2, 4, 1],
    ];
    const ids = coords.map((c) => wi.encode(c));
    ids.forEach((id) => setBit(mask, id));
    ids.forEach((id) => expect(hasBit(mask, id)).toBe(true));
    // neighbours not accidentally set
    expect(hasBit(mask, wi.encode([1, 1, 1, 2]))).toBe(false);
  });

  it("popcount equals number of setBit calls for distinct IDs", () => {
    const mask = createMask(SIZE);
    const coords: Array<[number, number, number, number]> = [
      [1, 1, 4, 1], [1, 2, 4, 1], [1, 3, 4, 1], [1, 4, 4, 1],  // admin production row 1
      [2, 1, 4, 1], [2, 2, 4, 1], [2, 3, 4, 1], [2, 4, 4, 1],  // admin production row 2
    ];
    coords.forEach((c) => setBit(mask, wi.encode(c)));
    expect(popcount(mask)).toBe(coords.length);
  });

  it("hasAnyBit finds overlap between user mask and target ID set", () => {
    // user has admin×production permissions for action=[read,write]
    const userMask = createMask(SIZE);
    setBit(userMask, wi.encode([3, 1, 4, 1]));  // database·read·admin·production
    setBit(userMask, wi.encode([3, 2, 4, 1]));  // database·write·admin·production

    // query: can user do anything on database in production?
    const databaseProdIds = [];
    for (let a = 1; a <= 4; a++)
      for (let ro = 1; ro <= 5; ro++)
        databaseProdIds.push(wi.encode([3, a, ro, 1]));

    expect(hasAnyBit(userMask, databaseProdIds)).toBe(true);

    // query: can user do anything in staging (env=2)?
    const stagingIds = [];
    for (let r = 1; r <= 8; r++)
      for (let a = 1; a <= 4; a++)
        for (let ro = 1; ro <= 5; ro++)
          stagingIds.push(wi.encode([r, a, ro, 2]));

    expect(hasAnyBit(userMask, stagingIds)).toBe(false);
  });
});
