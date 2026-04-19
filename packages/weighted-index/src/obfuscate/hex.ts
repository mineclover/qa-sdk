// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * hex.ts — Hex string serialization (encode/decode pair).
 *
 * ┌──────────────────────────────────────────────────────┐
 * │  encode:  toHex(id, bitWidth)      → hex string      │
 * │  decode:  fromHex(hex, bitWidth)   → number          │
 * │                                                      │
 * │  fromHex(toHex(id, w), w) === id                     │
 * └──────────────────────────────────────────────────────┘
 *
 * Output length = ceil(bitWidth / 4) hex characters (zero-padded).
 * Suitable for compact opaque tokens in URLs, headers, or DB columns.
 */

/**
 * Encode an integer as a zero-padded hex string.
 * Output length = ceil(bitWidth / 4) characters.
 *
 * @example
 * toHex(255, 10)  // → "0ff"  (10 bits → 3 hex chars)
 * toHex(0,   8)   // → "00"
 */
export function toHex(id: number, bitWidth: number): string {
  const hexLen = Math.ceil(bitWidth / 4);
  return id.toString(16).padStart(hexLen, "0");
}

/**
 * Decode a hex string back to an integer.
 * Validates that the hex length matches ceil(bitWidth / 4).
 *
 * @throws {RangeError} if hex.length !== ceil(bitWidth / 4)
 *
 * @example
 * fromHex("0ff", 10)  // → 255
 */
export function fromHex(hex: string, bitWidth: number): number {
  const expected = Math.ceil(bitWidth / 4);
  if (hex.length !== expected) {
    throw new RangeError(
      `hex length must be ${expected} for bitWidth=${bitWidth}, got ${hex.length}`
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new RangeError(
      `Invalid hex string: "${hex}" (must contain only hex characters)`
    );
  }
  return parseInt(hex, 16);
}
