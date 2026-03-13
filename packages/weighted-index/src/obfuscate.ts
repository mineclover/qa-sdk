/**
 * obfuscate.ts — Bijection-based integer ID obfuscation utilities.
 *
 * Transforms a WeightedIndex integer ID into an opaque token (hex / UUID-like)
 * and back. All transforms are bijections: decode(encode(id)) === id.
 *
 * Independent of WeightedIndex — only `size` or `bitWidth` is required.
 *
 * ⚠️  Designed for bitWidth ≤ 30 (JavaScript bitwise ops are 32-bit signed).
 *     WeightedIndex enforces size ≤ Number.MAX_SAFE_INTEGER, but practical
 *     permission / QA index sizes are well within this range.
 * ⚠️  Not cryptographically secure. Obfuscation only.
 */

// ── Type ─────────────────────────────────────────────────────────────────────

/** A bijective transform: (id, bitWidth) → transformed id. */
export type ObfuscateTransform = (id: number, bitWidth: number) => number;

// ── Bit-width helper ─────────────────────────────────────────────────────────

/**
 * Minimum number of bits needed to represent all IDs in [0, size-1].
 *
 * @example
 * calcBitWidth(640)  // → 10  (2^10 = 1024 ≥ 640)
 * calcBitWidth(1024) // → 10  (2^10 = 1024 ≥ 1024)
 * calcBitWidth(1025) // → 11
 */
export function calcBitWidth(size: number): number {
  return Math.max(1, Math.ceil(Math.log2(size)));
}

// ── Bijection transforms ─────────────────────────────────────────────────────

/**
 * XOR masking. Self-inverse: xorObfuscate(xorObfuscate(id, w, key), w, key) === id.
 *
 * @param key  Any integer; only the lower `bitWidth` bits are used.
 *
 * @example
 * xorObfuscate(65, 8, 0xA3)  // → 162  (0b01000001 ^ 0b10100011)
 */
export function xorObfuscate(id: number, bitWidth: number, key: number): number {
  const mask = (1 << bitWidth) - 1;
  return (id ^ key) & mask;
}

/**
 * Cyclic left bit rotation within `bitWidth` bits.
 * Inverse: rotateRight(rotateLeft(id, w, k), w, k) === id.
 *
 * @param amount  Rotation distance in [1, bitWidth-1]. 0 is a no-op.
 *
 * @example
 * rotateLeft(0b00000001, 8, 1) // → 0b00000010
 * rotateLeft(0b10000000, 8, 1) // → 0b00000001  (wraps)
 */
export function rotateLeft(id: number, bitWidth: number, amount: number): number {
  const a = ((amount % bitWidth) + bitWidth) % bitWidth;
  if (a === 0) return id;
  const mask = (1 << bitWidth) - 1;
  return ((id << a) | (id >>> (bitWidth - a))) & mask;
}

/**
 * Cyclic right bit rotation within `bitWidth` bits.
 * Inverse: rotateLeft(rotateRight(id, w, k), w, k) === id.
 *
 * @param amount  Rotation distance in [1, bitWidth-1]. 0 is a no-op.
 */
export function rotateRight(id: number, bitWidth: number, amount: number): number {
  const a = ((amount % bitWidth) + bitWidth) % bitWidth;
  if (a === 0) return id;
  const mask = (1 << bitWidth) - 1;
  return ((id >>> a) | (id << (bitWidth - a))) & mask;
}

/**
 * Reverse the bit order within `bitWidth` bits. Self-inverse.
 *
 * @example
 * reverseBits(0b10110000, 8) // → 0b00001101
 */
export function reverseBits(id: number, bitWidth: number): number {
  let result = 0;
  let n = id;
  for (let i = 0; i < bitWidth; i++) {
    result = (result << 1) | (n & 1);
    n >>>= 1;
  }
  return result;
}

// ── Composition ──────────────────────────────────────────────────────────────

/**
 * Chain multiple ObfuscateTransforms left-to-right.
 * If each transform is a bijection, the composition is also a bijection.
 *
 * @example
 * const enc = compose(
 *   (id, w) => rotateLeft(id, w, 3),
 *   (id, w) => xorObfuscate(id, w, 0xA3),
 * );
 * const dec = compose(
 *   (id, w) => xorObfuscate(id, w, 0xA3),  // XOR is self-inverse
 *   (id, w) => rotateRight(id, w, 3),
 * );
 * dec(enc(id, bitWidth), bitWidth) === id
 */
export function compose(...transforms: ObfuscateTransform[]): ObfuscateTransform {
  return (id, bitWidth) =>
    transforms.reduce((acc, fn) => fn(acc, bitWidth), id);
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Encode an obfuscated integer as a zero-padded hex string.
 * Output length = ceil(bitWidth / 4) hex chars.
 *
 * @example
 * toHex(255, 10)  // → "0ff"  (10 bits → 3 hex chars)
 */
export function toHex(id: number, bitWidth: number): string {
  const hexLen = Math.ceil(bitWidth / 4);
  return id.toString(16).padStart(hexLen, "0");
}

/**
 * Parse a hex string back to an integer. Validates expected length.
 *
 * @throws {RangeError} if hex.length !== ceil(bitWidth / 4)
 */
export function fromHex(hex: string, bitWidth: number): number {
  const expected = Math.ceil(bitWidth / 4);
  if (hex.length !== expected) {
    throw new RangeError(
      `hex length must be ${expected} for bitWidth=${bitWidth}, got ${hex.length}`
    );
  }
  return parseInt(hex, 16);
}

/**
 * Format an obfuscated integer as a UUID-like string (8-4-4-4-12 hex).
 * The ID value is placed in the least-significant bits of 128-bit space.
 *
 * @example
 * toUUID(12345, 10)
 * // → "00000000-0000-0000-0000-000000003039"
 */
export function toUUID(id: number, _bitWidth: number): string {
  const hex = id.toString(16).padStart(32, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Parse a UUID-like string back to an integer. Strips dashes then parses hex.
 */
export function fromUUID(uuid: string): number {
  return parseInt(uuid.replace(/-/g, ""), 16);
}
