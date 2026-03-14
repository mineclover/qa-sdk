/**
 * nanoid.ts — Compact base64url serialization (encode/decode pair).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  encode:  toNanoId(id, bitWidth)      → short URL-safe string      │
 * │  decode:  fromNanoId(token, bitWidth) → number                     │
 * │                                                                     │
 * │  fromNanoId(toNanoId(id, w), w) === id                              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Alphabet: URL-safe base64 (RFC 4648 §5) — 64 chars, 6 bits per char.
 *   A-Z (0–25) · a-z (26–51) · 0-9 (52–61) · - (62) · _ (63)
 *
 * Output length = ceil(bitWidth / 6), always shorter than toHex (4 bits/char):
 *   bitWidth=10 → 2 chars  (hex: 3)
 *   bitWidth=16 → 3 chars  (hex: 4)
 *   bitWidth=30 → 5 chars  (hex: 8)
 *
 * Use when a compact, URL-safe token is needed.
 * Use toHex for lowercase hex compatibility.
 * Use toUUID when the output must conform to UUID shape.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Encode an integer as a compact base64url string.
 * Length = ceil(bitWidth / 6). MSB first.
 *
 * @example
 * toNanoId(42, 10)   // → "Aq"  (bitWidth=10 → 2 chars)
 * toNanoId(255, 8)   // → "D/"  wait — let's use actual calc:
 * toNanoId(255, 8)   // → "D_"  (255 = 0b11_111111; chars: [3,'_'])
 */
export function toNanoId(id: number, bitWidth: number): string {
  const len = Math.ceil(bitWidth / 6);
  let result = "";
  let n = id;
  for (let i = 0; i < len; i++) {
    result = ALPHABET[n & 0x3F] + result;
    n >>>= 6;
  }
  return result;
}

/**
 * Decode a base64url token back to an integer.
 * Throws RangeError if the token length is wrong or contains invalid chars.
 *
 * @example
 * fromNanoId("Aq", 10)  // → 42
 */
export function fromNanoId(token: string, bitWidth: number): number {
  const len = Math.ceil(bitWidth / 6);
  if (token.length !== len) {
    throw new RangeError(
      `fromNanoId: expected ${len} chars for bitWidth ${bitWidth}, got ${token.length}`
    );
  }
  let result = 0;
  for (const ch of token) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new RangeError(`fromNanoId: invalid character '${ch}'`);
    }
    result = (result << 6) | idx;
  }
  return result;
}
