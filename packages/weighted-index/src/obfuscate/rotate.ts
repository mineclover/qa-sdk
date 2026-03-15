/**
 * rotate.ts — Cyclic bit rotation (bijection pair).
 *
 * ┌────────────────────────────────────────────────────────┐
 * │  encode:  rotateLeft(id, bitWidth, amount)  → token    │
 * │  decode:  rotateRight(token, bitWidth, amount) → id    │
 * │                                                        │
 * │  rotateRight(rotateLeft(id, w, k), w, k) === id        │
 * └────────────────────────────────────────────────────────┘
 *
 * Variation parameter: amount — rotation distance in [1, bitWidth-1].
 *   0 or multiples of bitWidth are identity (no-op).
 *   amount > bitWidth is reduced via modulo.
 *
 * ⚠️  Not cryptographically secure. Obfuscation only.
 *     DO NOT use for access control, authorization tokens, or session IDs.
 *     The rotation amount has at most (bitWidth - 1) possible values,
 *     making brute-force trivial. For security, prefer AES or Web Crypto API.
 */

/**
 * Cyclic left rotation within `bitWidth` bits. Use as the encode direction.
 *
 * **Security notice**: This is a visual identifier transform only. The rotation
 * amount can be brute-forced in at most (bitWidth - 1) attempts.
 *
 * @param amount  Rotation distance. Reduced mod bitWidth; 0 is identity.
 *
 * @example
 * rotateLeft(0b10000000, 8, 1) // → 0b00000001  (MSB wraps to LSB)
 */
export function rotateLeft(id: number, bitWidth: number, amount: number): number {
  const a = ((amount % bitWidth) + bitWidth) % bitWidth;
  if (a === 0) return id;
  const mask = (1 << bitWidth) - 1;
  return ((id << a) | (id >>> (bitWidth - a))) & mask;
}

/**
 * Cyclic right rotation within `bitWidth` bits. Use as the decode direction.
 *
 * **Security notice**: This is a visual identifier transform only.
 *
 * @param amount  Rotation distance. Must match the amount used in rotateLeft.
 *
 * @example
 * rotateRight(0b00000001, 8, 1) // → 0b10000000  (LSB wraps to MSB)
 */
export function rotateRight(id: number, bitWidth: number, amount: number): number {
  const a = ((amount % bitWidth) + bitWidth) % bitWidth;
  if (a === 0) return id;
  const mask = (1 << bitWidth) - 1;
  return ((id >>> a) | (id << (bitWidth - a))) & mask;
}
