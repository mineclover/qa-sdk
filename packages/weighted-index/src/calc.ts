/**
 * calc.ts — Standalone calculation utilities for weighted positional notation.
 *
 * Pure functions only. No class instantiation required. No DOM dependencies.
 * Safe for server, worker, and test environments.
 */

/**
 * Compute the weight array for a given shape.
 *
 * W[i] = Π_{j > i} shape[j]   (= 1 for the last dimension)
 *
 * Matches the weight formula used inside WeightedIndex:
 *   encode: index = Σ (x_i − 1) × W[i]
 *
 * @example
 * calcWeights([8, 4, 5, 4]) // → [80, 20, 4, 1]
 */
export function calcWeights(shape: readonly number[]): number[] {
  return shape.map((_, i) =>
    shape.slice(i + 1).reduce((product, n) => product * n, 1)
  );
}

/**
 * Compute the constant (base) contribution of a partial query.
 *
 * For each fixed dimension i (fixedCoords[i] !== null), adds (coord − 1) × W[i].
 * Free dimensions (null) contribute nothing to the base.
 *
 * Use this to pre-compute the invariant part of a range query before
 * iterating over free dimensions.
 *
 * @example
 * // Fix role=4, env=1 with weights [80,20,4,1]
 * partialQueryBase([80,20,4,1], [null, null, 4, 1]) // → 12
 */
export function partialQueryBase(
  weights:     readonly number[],
  fixedCoords: ReadonlyArray<number | null>,
): number {
  return fixedCoords.reduce<number>((acc, x, i) => {
    return acc + (x !== null ? (x - 1) * weights[i] : 0);
  }, 0);
}

/**
 * Describe a partial query as a human-readable formula string.
 *
 * Fixed dimensions appear as their numeric contribution;
 * free dimensions appear as symbolic terms using the provided labels.
 *
 * Returns a string of the form "base + (label_i−1)×W_i + ..."
 * where base may be 0 (omitted from the left side if so).
 *
 * @example
 * describeRangeFormula(
 *   [80, 20, 4, 1],
 *   [null, null, 4, 1],
 *   ["resource", "action", "role", "env"]
 * )
 * // → "12 + (resource−1)×80 + (action−1)×20"
 */
export function describeRangeFormula(
  weights:     readonly number[],
  fixedCoords: ReadonlyArray<number | null>,
  labels:      readonly string[],
): string {
  const base = partialQueryBase(weights, fixedCoords);
  const freeTerms = fixedCoords
    .map((x, i) => x === null ? `(${labels[i]}−1)×${weights[i]}` : null)
    .filter((t): t is string => t !== null);

  if (freeTerms.length === 0) return String(base);
  const freeStr = freeTerms.join(" + ");
  return base === 0 ? freeStr : `${base} + ${freeStr}`;
}
