/**
 * reverse.ts — Bit-order reversal (self-inverse bijection).
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  encode:  reverseBits(id,    bitWidth)  → token          │
 * │  decode:  reverseBits(token, bitWidth)  → id             │
 * │                                                          │
 * │  encode === decode  (reversing twice restores original)  │
 * └──────────────────────────────────────────────────────────┘
 *
 * No variation parameter — reversal is deterministic.
 *
 * ⚠️  Not cryptographically secure. Obfuscation only.
 *     DO NOT use for access control, authorization tokens, or session IDs.
 *     This transform is fully deterministic with no key — the output is
 *     trivially reversible by anyone. For security, prefer AES or Web Crypto API.
 */

/**
 * Reverse the bit order within `bitWidth` bits.
 *
 * Applying the same function twice with the same bitWidth restores the original:
 *   reverseBits(reverseBits(id, w), w) === id
 *
 * **Security notice**: This is a visual identifier transform only. There is no
 * secret key — the transform is fully deterministic and trivially reversible.
 *
 * @example
 * reverseBits(0b10110000, 8) // → 0b00001101
 * reverseBits(0b10101010, 8) // → 0b01010101
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
