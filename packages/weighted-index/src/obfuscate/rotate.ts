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
 */

/**
 * Cyclic left rotation within `bitWidth` bits. Use as the encode direction.
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
