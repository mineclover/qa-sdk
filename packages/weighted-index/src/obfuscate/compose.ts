// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * compose.ts — Transform composition utility.
 *
 * Chains multiple ObfuscateTransforms left-to-right.
 * If each transform is a bijection, the composition is also a bijection.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  encode:  compose(f1, f2, f3)                                    │
 * │  decode:  compose(f3_inv, f2_inv, f1_inv)  ← reversed order     │
 * │                                                                  │
 * │  decode(encode(id, w), w) === id                                 │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * @example
 * import { rotateLeft, rotateRight } from "./rotate.js";
 * import { xorObfuscate } from "./xor.js";
 *
 * const enc = compose(
 *   (id, w) => rotateLeft(id, w, 3),
 *   (id, w) => xorObfuscate(id, w, 0xA3),
 * );
 * const dec = compose(
 *   (id, w) => xorObfuscate(id, w, 0xA3),   // XOR is self-inverse
 *   (id, w) => rotateRight(id, w, 3),        // reverse of rotateLeft
 * );
 * dec(enc(id, bitWidth), bitWidth) === id
 */

/** A bijective transform: (id, bitWidth) → transformed id. */
export type ObfuscateTransform = (id: number, bitWidth: number) => number;

/**
 * Chain ObfuscateTransforms left-to-right into a single transform.
 * Empty compose returns the identity transform.
 */
export function compose(...transforms: ObfuscateTransform[]): ObfuscateTransform {
  return (id, bitWidth) => transforms.reduce((acc, fn) => fn(acc, bitWidth), id);
}
