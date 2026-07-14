// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * bitmask.ts — Bit-packed permission mask utilities.
 *
 * Each bit position in a Uint8Array corresponds to a single permission ID —
 * the integer output of WeightedIndex.encode(). This allows O(1) permission
 * checks and compact storage: a 640-slot index needs only 80 bytes.
 *
 * All single-id operations are O(1). Batch / mask operations are O(size/8).
 */

// ── Single-bit operations ─────────────────────────────────────────────────

/** Create a zero-filled mask for a WeightedIndex of the given size. */
export function createMask(size: number): Uint8Array {
  return new Uint8Array(Math.ceil(size / 8));
}

function _checkBitBounds(mask: Uint8Array, id: number): void {
  if (!Number.isInteger(id) || id < 0 || id >= mask.length * 8) {
    throw new RangeError(`Bit id ${id} is out of range [0, ${mask.length * 8})`);
  }
}

/**
 * Set the bit at position id (grant permission).
 *
 * @param id Must be in range `[0, mask.length * 8)`.
 * @throws {RangeError} if id is out of bounds
 */
export function setBit(mask: Uint8Array, id: number): void {
  _checkBitBounds(mask, id);
  mask[id >> 3] |= 1 << (id & 7);
}

/**
 * Clear the bit at position id (revoke permission).
 *
 * @param id Must be in range `[0, mask.length * 8)`.
 * @throws {RangeError} if id is out of bounds
 */
export function clearBit(mask: Uint8Array, id: number): void {
  _checkBitBounds(mask, id);
  mask[id >> 3] &= ~(1 << (id & 7));
}

/**
 * Test whether permission id is set. O(1).
 *
 * @param id Must be in range `[0, mask.length * 8)`.
 * @throws {RangeError} if id is out of bounds
 *
 * @example
 * const id = wi.encode([resource, action, role, env]);
 * if (hasBit(userMask, id)) { ... }
 */
export function hasBit(mask: Uint8Array, id: number): boolean {
  _checkBitBounds(mask, id);
  return (mask[id >> 3] & (1 << (id & 7))) !== 0;
}

// ── Batch operations ──────────────────────────────────────────────────────

/**
 * Build a mask from an iterable of permission ids.
 * Equivalent to calling setBit for each id.
 */
export function buildMask(size: number, ids: Iterable<number>): Uint8Array {
  const mask = createMask(size);
  for (const id of ids) setBit(mask, id);
  return mask;
}

/**
 * Return true if at least one id in the iterable has its bit set. O(|ids|).
 *
 * Use this to check "does the user have any of these permissions?", e.g.
 * when the query spans multiple roles.
 */
export function hasAnyBit(mask: Uint8Array, ids: Iterable<number>): boolean {
  for (const id of ids) {
    if (hasBit(mask, id)) return true;
  }
  return false;
}

/**
 * Return true if every id in the iterable has its bit set. O(|ids|).
 * Use this to check "does the user have ALL of these permissions?".
 */
export function hasAllBits(mask: Uint8Array, ids: Iterable<number>): boolean {
  for (const id of ids) {
    if (!hasBit(mask, id)) return false;
  }
  return true;
}

/**
 * Count the number of set bits (population count / Hamming weight).
 * Useful for reporting "this user has N granted permissions".
 */
export function popcount(mask: Uint8Array): number {
  let n = 0;
  for (const byte of mask) {
    let b = byte;
    while (b) {
      n += b & 1;
      b >>>= 1;
    }
  }
  return n;
}

// ── Mask algebra ──────────────────────────────────────────────────────────

/** Intersection: bits set in BOTH a and b (user has all required permissions). */
export function maskAnd(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new RangeError(`Mask length mismatch: ${a.length} vs ${b.length}`);
  }
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}

/** Union: bits set in EITHER a or b. */
export function maskOr(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new RangeError(`Mask length mismatch: ${a.length} vs ${b.length}`);
  }
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] | b[i];
  return out;
}

/** Return true if (a AND b) is non-zero — i.e. a and b share at least one bit. */
export function masksOverlap(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    throw new RangeError(`Mask length mismatch: ${a.length} vs ${b.length}`);
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] & b[i]) return true;
  }
  return false;
}

// ── Power-of-2 utilities ─────────────────────────────────────────────────

/** n이 2의 거듭제곱인지 판별 */
export function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** n 이상의 최소 2의 거듭제곱. 최솟값 1. */
export function nextPowerOf2(n: number): number {
  let v = n - 1;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return Math.max(v + 1, 1);
}
