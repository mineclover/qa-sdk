/**
 * xor.ts — XOR obfuscation (self-inverse bijection).
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  encode:  xorObfuscate(id,  bitWidth, key)  → token │
 * │  decode:  xorObfuscate(token, bitWidth, key) → id   │
 * │                                                     │
 * │  encode === decode  (XOR is self-inverse)           │
 * └─────────────────────────────────────────────────────┘
 *
 * Variation parameter: key — any integer; only lower `bitWidth` bits are used.
 *
 * ⚠️  Not cryptographically secure. Obfuscation only.
 *     DO NOT use for access control, authorization tokens, or session IDs.
 *     A single known (plaintext, ciphertext) pair reveals the key: key = p XOR c.
 *     For security use cases, prefer AES-128-CTR or Web Crypto API.
 */

/**
 * XOR obfuscate / deobfuscate: id ⊕ (key & mask).
 *
 * Applying the same function twice with the same key restores the original:
 *   xorObfuscate(xorObfuscate(id, w, key), w, key) === id
 *
 * **Security notice**: This is a visual identifier transform only. The XOR key
 * is trivially recoverable from any known (input, output) pair. Never use this
 * to protect sensitive data or as a substitute for encryption.
 *
 * @param key  Key value. Only the lower `bitWidth` bits are applied.
 */
export function xorObfuscate(id: number, bitWidth: number, key: number): number {
  const mask = (1 << bitWidth) - 1;
  return (id ^ key) & mask;
}
