// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from 'vitest';
import { toNanoId, fromNanoId } from './nanoid.js';

describe('toNanoId (encode)', () => {
  it('bitWidth=10 → 2 chars', () => {
    expect(toNanoId(0, 10)).toHaveLength(2);
    expect(toNanoId(42, 10)).toHaveLength(2);
    expect(toNanoId(1023, 10)).toHaveLength(2);
  });

  it('bitWidth=8 → 2 chars (ceil(8/6)=2)', () => {
    expect(toNanoId(0, 8)).toHaveLength(2);
    expect(toNanoId(255, 8)).toHaveLength(2);
  });

  it('bitWidth=16 → 3 chars', () => {
    expect(toNanoId(0, 16)).toHaveLength(3);
    expect(toNanoId(0xffff, 16)).toHaveLength(3);
  });

  it('bitWidth=30 → 5 chars', () => {
    expect(toNanoId(0, 30)).toHaveLength(5);
    expect(toNanoId((1 << 30) - 1, 30)).toHaveLength(5);
  });

  it('output chars are all in base64url alphabet', () => {
    const re = /^[A-Za-z0-9\-_]+$/;
    const cases: [number, number][] = [
      [42, 10],
      [255, 8],
      [1023, 10],
      [0xffff, 16],
    ];
    for (const [id, w] of cases) {
      expect(toNanoId(id, w)).toMatch(re);
    }
  });

  it("id=0 encodes to all-'A' string", () => {
    expect(toNanoId(0, 10)).toBe('AA');
    expect(toNanoId(0, 16)).toBe('AAA');
  });

  it('shorter than hex for same bitWidth', () => {
    // hex: ceil(10/4)=3 chars; nanoId: ceil(10/6)=2 chars
    expect(toNanoId(42, 10).length).toBeLessThan(3);
  });
});

describe('fromNanoId (decode)', () => {
  it('round-trip: fromNanoId(toNanoId(id, w), w) === id', () => {
    const cases: [number, number][] = [
      [0, 10],
      [1, 10],
      [42, 10],
      [1023, 10],
      [0, 8],
      [255, 8],
      [0, 16],
      [0xffff, 16],
      [0, 30],
      [(1 << 30) - 1, 30],
    ];
    for (const [id, w] of cases) {
      expect(fromNanoId(toNanoId(id, w), w)).toBe(id);
    }
  });

  it('full 10-bit space round-trip', () => {
    const w = 10;
    for (let id = 0; id < 1024; id++) {
      expect(fromNanoId(toNanoId(id, w), w)).toBe(id);
    }
  });

  it('throws RangeError on wrong length', () => {
    expect(() => fromNanoId('A', 10)).toThrow(RangeError);
    expect(() => fromNanoId('AAA', 10)).toThrow(RangeError);
  });

  it('throws RangeError on invalid character', () => {
    expect(() => fromNanoId('A!', 10)).toThrow(RangeError);
    expect(() => fromNanoId('A@', 10)).toThrow(RangeError);
  });

  it('bijection: all 10-bit IDs map to distinct tokens', () => {
    const w = 10;
    const results = new Set<string>();
    for (let id = 0; id < 1024; id++) results.add(toNanoId(id, w));
    expect(results.size).toBe(1024);
  });
});
