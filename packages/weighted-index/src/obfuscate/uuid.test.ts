// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from 'vitest';
import { toUUID, fromUUID, toStructuredUUID, fromStructuredUUID } from './uuid.js';

describe('toUUID (encode) — MSB placement', () => {
  it('output matches 8-4-4-4-12 format', () => {
    expect(toUUID(12345, 10)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('id=0 is all-zero UUID regardless of bitWidth', () => {
    expect(toUUID(0, 8)).toBe('00000000-0000-0000-0000-000000000000');
    expect(toUUID(0, 10)).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('ID occupies the prefix (first segment), remainder is zero', () => {
    // bitWidth=8 → hexLen=2; first 2 chars = id hex, rest zeros
    expect(toUUID(1, 8)).toBe('01000000-0000-0000-0000-000000000000');
    expect(toUUID(255, 8)).toBe('ff000000-0000-0000-0000-000000000000');
  });

  it('bitWidth=10 → hexLen=3; id fills first 3 hex chars', () => {
    expect(toUUID(42, 10)).toBe('02a00000-0000-0000-0000-000000000000');
    expect(toUUID(1023, 10)).toBe('3ff00000-0000-0000-0000-000000000000');
  });

  it('bitWidth=16 → hexLen=4; id fills first 4 hex chars', () => {
    expect(toUUID(0xffff, 16)).toBe('ffff0000-0000-0000-0000-000000000000');
  });

  it('bitWidth=30 (max) → hexLen=8; fills entire first segment', () => {
    const max = (1 << 30) - 1; // 0x3fffffff
    const result = toUUID(max, 30);
    expect(result).toMatch(/^3fffffff-0000-0000-0000-000000000000$/);
  });
});

describe('fromUUID (decode)', () => {
  it('round-trip: fromUUID(toUUID(id, w), w) === id', () => {
    const cases: [number, number][] = [
      [0, 8],
      [1, 8],
      [255, 8],
      [42, 10],
      [1023, 10],
      [0xffff, 16],
      [12345678, 30],
    ];
    for (const [id, w] of cases) {
      expect(fromUUID(toUUID(id, w), w)).toBe(id);
    }
  });

  it('accepts uppercase input', () => {
    const uuid = toUUID(255, 8).toUpperCase();
    expect(fromUUID(uuid, 8)).toBe(255);
  });

  it('full 10-bit space round-trip', () => {
    const w = 10;
    for (let id = 0; id < 1024; id++) {
      expect(fromUUID(toUUID(id, w), w)).toBe(id);
    }
  });
});

describe('toStructuredUUID — compact bit-packed token', () => {
  it('output length = ceil(totalBits / 4), dashed every 4 chars', () => {
    // 22 bits → 6 hex chars → "xxxx-xx"
    const token = toStructuredUUID([
      { value: 2, bitWidth: 4 },
      { value: 7, bitWidth: 8 },
      { value: 42, bitWidth: 10 },
    ]);
    expect(token.replace(/-/g, '')).toHaveLength(6);
    expect(token).toMatch(/^[0-9a-f]{4}-[0-9a-f]{2}$/);
  });

  it('4-bit single field → 1 hex char, no dash', () => {
    expect(toStructuredUUID([{ value: 0xf, bitWidth: 4 }])).toBe('f');
    expect(toStructuredUUID([{ value: 0, bitWidth: 4 }])).toBe('0');
  });

  it('8-bit single field → 2 hex chars, no dash', () => {
    expect(toStructuredUUID([{ value: 255, bitWidth: 8 }])).toBe('ff');
    expect(toStructuredUUID([{ value: 0, bitWidth: 8 }])).toBe('00');
  });

  it('16-bit → 4 hex chars, no dash (exactly 1 group)', () => {
    expect(toStructuredUUID([{ value: 0xabcd, bitWidth: 16 }])).toBe('abcd');
  });

  it("20-bit → 5 hex chars → 'xxxx-x'", () => {
    expect(toStructuredUUID([{ value: 0, bitWidth: 20 }])).toBe('0000-0');
  });

  it('all-zero fields produce correct-length zero string', () => {
    const token = toStructuredUUID([
      { value: 0, bitWidth: 8 },
      { value: 0, bitWidth: 8 },
    ]);
    expect(token.replace(/-/g, '')).toBe('0000');
  });

  it('no trailing zeros beyond what data requires', () => {
    // 10-bit id=42 → ceil(10/4) = 3 hex chars only
    const token = toStructuredUUID([{ value: 42, bitWidth: 10 }]);
    expect(token.replace(/-/g, '')).toHaveLength(3);
  });
});

describe('fromStructuredUUID — compact unpacking', () => {
  it('round-trip: decode matches encode', () => {
    const fields = [
      { value: 2, bitWidth: 4 },
      { value: 7, bitWidth: 8 },
      { value: 42, bitWidth: 10 },
    ];
    const token = toStructuredUUID(fields);
    expect(
      fromStructuredUUID(
        token,
        fields.map((f) => f.bitWidth),
      ),
    ).toEqual([2, 7, 42]);
  });

  it('single field round-trip over full 10-bit space', () => {
    for (let id = 0; id < 1024; id++) {
      const token = toStructuredUUID([{ value: id, bitWidth: 10 }]);
      expect(fromStructuredUUID(token, [10])).toEqual([id]);
    }
  });

  it('version nibble (4-bit) + id (10-bit) round-trip', () => {
    const cases: [number, number][] = [
      [1, 0],
      [3, 639],
      [15, 255],
    ];
    for (const [ver, id] of cases) {
      const token = toStructuredUUID([
        { value: ver, bitWidth: 4 },
        { value: id, bitWidth: 10 },
      ]);
      expect(fromStructuredUUID(token, [4, 10])).toEqual([ver, id]);
    }
  });

  it('sub-nibble fields (1-bit flags) round-trip', () => {
    const token = toStructuredUUID([
      { value: 1, bitWidth: 1 },
      { value: 0, bitWidth: 1 },
      { value: 42, bitWidth: 10 },
    ]);
    expect(fromStructuredUUID(token, [1, 1, 10])).toEqual([1, 0, 42]);
  });

  it('compact token is shorter than full UUID', () => {
    const token = toStructuredUUID([
      { value: 1, bitWidth: 4 },
      { value: 42, bitWidth: 10 },
    ]);
    // 14 bits → 4 hex chars → "xxxx", vs UUID's 36 chars
    expect(token.replace(/-/g, '').length).toBeLessThanOrEqual(4);
  });
});
