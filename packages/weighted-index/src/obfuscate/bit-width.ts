/**
 * bit-width.ts — Minimum bit width for a given index space.
 *
 * The bit width is the foundation shared by all obfuscation transforms.
 * Every transform operates within exactly [0, 2^bitWidth − 1].
 *
 * Since WeightedIndex exposes `size`, `calcBitWidth(wi.size)` is always
 * deterministic and does NOT need to be stored separately.
 */

/**
 * Minimum number of bits needed to represent all IDs in [0, size-1].
 *
 * @example
 * calcBitWidth(640)  // → 10  (2^10 = 1024 ≥ 640)
 * calcBitWidth(1024) // → 10
 * calcBitWidth(1025) // → 11
 */
export function calcBitWidth(size: number): number {
  return Math.max(1, Math.ceil(Math.log2(size)));
}
