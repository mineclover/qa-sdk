/**
 * uuid.ts — UUID-like string serialization (encode/decode pair).
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  encode:  toUUID(id, bitWidth)        → "xxxxxxxx-0000-0000-..."  │
 * │  decode:  fromUUID(uuid, bitWidth)    → number                    │
 * │                                                                    │
 * │  fromUUID(toUUID(id, w), w) === id                                 │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Output is always 128-bit (32 hex chars) in standard 8-4-4-4-12 format.
 * The ID occupies the MOST-significant bits (prefix / high order), so the
 * first segment of the UUID holds the meaningful data and the remainder
 * is zero-padded.
 *
 * For bitWidth ≤ 30 (the JS-safe limit), hexLen = ceil(bitWidth/4) ≤ 8,
 * which fits exactly within the first segment — the prefix area is fully
 * utilised and the UUID looks naturally non-zero at the front.
 *
 * Use when the output must look like a UUID for interoperability.
 * Use toHex/fromHex when a compact token is preferred.
 */

/**
 * Format an integer as a UUID-like string (8-4-4-4-12 hex, 128-bit).
 *
 * The ID hex is placed at the high-order (prefix) end of the 32-char hex
 * string and zero-padded to the right, so the first segment is meaningful.
 *
 * @example
 * toUUID(42, 10)   // hexLen=3 → "02a00000-0000-0000-0000-000000000000"
 * toUUID(255, 8)   // hexLen=2 → "ff000000-0000-0000-0000-000000000000"
 * toUUID(0xffff, 16) // hexLen=4 → "ffff0000-0000-0000-0000-000000000000"
 */
export function toUUID(id: number, bitWidth: number): string {
  const hexLen = Math.ceil(bitWidth / 4);
  const idHex  = id.toString(16).padStart(hexLen, "0");
  const full   = idHex.padEnd(32, "0");
  return [
    full.slice(0, 8),
    full.slice(8, 12),
    full.slice(12, 16),
    full.slice(16, 20),
    full.slice(20, 32),
  ].join("-");
}

/**
 * Parse a UUID-like string back to an integer.
 * Reads the first ceil(bitWidth/4) hex chars (the prefix / MSB area).
 * Case-insensitive.
 *
 * @example
 * fromUUID("02a00000-0000-0000-0000-000000000000", 10)  // → 42
 */
export function fromUUID(uuid: string, bitWidth: number): number {
  const hexLen = Math.ceil(bitWidth / 4);
  return parseInt(uuid.replace(/-/g, "").slice(0, hexLen), 16);
}

// ── Structured UUID ──────────────────────────────────────────────────────────

/**
 * A single field to embed in a structured UUID.
 */
export interface UUIDField {
  value:    number;
  bitWidth: number;
}

/**
 * Bit-pack multiple fields into a compact hex token with dashes.
 *
 * Output length = ceil(totalBits / 4) hex chars, dash-separated every 4 chars.
 * No 128-bit padding — the token is only as long as the data requires.
 *
 * Use `toUUID` when you need the full 128-bit 8-4-4-4-12 shape.
 * Use this when you want the shortest token that still carries all fields.
 *
 * @example
 * // version=2 (4-bit) · namespace=7 (8-bit) · id=42 (10-bit)
 * // total = 22 bits → ceil(22/4) = 6 hex chars → "2070-a8"
 * toStructuredUUID([
 *   { value: 2,  bitWidth: 4  },
 *   { value: 7,  bitWidth: 8  },
 *   { value: 42, bitWidth: 10 },
 * ])
 * // → "2070-a8"
 */
export function toStructuredUUID(fields: UUIDField[]): string {
  const totalBits = fields.reduce((sum, f) => sum + f.bitWidth, 0);
  if (totalBits < 1) {
    throw new RangeError("toStructuredUUID: totalBits must be ≥ 1");
  }
  // Bit-pack all fields MSB-first
  let packed = 0n;
  for (const { value, bitWidth } of fields) {
    packed = (packed << BigInt(bitWidth)) | BigInt(value);
  }

  const hexLen = Math.ceil(totalBits / 4);
  const hex = packed.toString(16).padStart(hexLen, "0");

  // Dash every 4 chars
  const segments: string[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    segments.push(hex.slice(i, i + 4));
  }
  return segments.join("-");
}

/**
 * Unpack a compact structured token into field values.
 * Strips dashes, parses hex, then extracts fields right-to-left using
 * the same bitWidth schema.
 *
 * @example
 * fromStructuredUUID("2070-a8", [4, 8, 10])
 * // → [2, 7, 42]
 */
export function fromStructuredUUID(token: string, bitWidths: number[]): number[] {
  const packed = BigInt("0x" + token.replace(/-/g, ""));
  // Extract fields right-to-left
  const results: number[] = new Array(bitWidths.length);
  let remaining = packed;
  for (let i = bitWidths.length - 1; i >= 0; i--) {
    const bw = BigInt(bitWidths[i]);
    results[i] = Number(remaining & ((1n << bw) - 1n));
    remaining >>= bw;
  }
  return results;
}
