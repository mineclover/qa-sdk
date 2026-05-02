// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * bit-field-layout.ts — Bit-level variable-width field packing.
 *
 * Packs named fields at exact bit boundaries instead of hex-char (4-bit) boundaries.
 * Reclaims wasted bits when field max values don't align to powers of 16.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  hex mode:  [4b prefix][4b version][4b shard][116b index]  │
 * │  bit mode:  [4b prefix][3b version][2b shard][119b index]  │
 * │                                               ↑ +3 bits    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * uuid-layout.ts의 hex-char 기반 패킹과 병행 사용 가능.
 * 저장 밀도가 중요한 경로에서는 bit-level, 디버그/표시에는 hex-level 권장.
 *
 * @example
 * const layout = createBitFieldLayout([
 *   { name: "prefix",  maxValue: 15 },    // 4 bits (hex과 동일)
 *   { name: "version", maxValue: 7 },     // 3 bits (hex: 4 → 1 bit 절약)
 *   { name: "shard",   maxValue: 3 },     // 2 bits (hex: 4 → 2 bit 절약)
 *   { name: "index",   maxValue: 99999 }, // 17 bits (hex: 20 → 3 bit 절약)
 * ]);
 * // totalBits: 26, hex 기준: 32 → 6 bits 절약 (64× 용량 증가 가능)
 */

import { charsForMax } from "./uuid-layout.js";

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BitFieldSpec {
  name: string;
  /** 이 필드가 담아야 할 최대값 (inclusive). bits = ⌈log₂(maxValue + 1)⌉ */
  maxValue: number;
  /** 명시적 비트 폭 (maxValue 기반 자동 계산보다 우선) */
  bits?: number;
}

export interface BitField {
  readonly name: string;
  /** 할당된 비트 폭 */
  readonly bits: number;
  /** 이 필드가 실제로 담을 수 있는 최대값 (2^bits - 1) */
  readonly maxValue: bigint;
  /** MSB로부터의 비트 오프셋 (0 = 최상위) */
  readonly offset: number;
}

export interface BitFieldLayout {
  readonly fields: readonly BitField[];
  readonly totalBits: number;
  /** ⌈totalBits / 8⌉ */
  readonly totalBytes: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Core
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 0..maxValue를 표현하는 데 필요한 최소 비트 수.
 *
 * @example
 * bitsForMax(0)   // 0
 * bitsForMax(1)   // 1
 * bitsForMax(7)   // 3
 * bitsForMax(255) // 8
 * bitsForMax(256) // 9
 */
export function bitsForMax(maxValue: number): number {
  if (maxValue <= 0) return 0;
  if (maxValue === 1) return 1;
  return Math.ceil(Math.log2(maxValue + 1));
}

/**
 * 비트 레벨 필드 레이아웃 정의.
 *
 * 필드는 MSB-first 순서로 배치된다 (첫 번째 필드가 최상위 비트 차지).
 *
 * @throws {RangeError} specs가 비어있거나 필드의 비트 폭이 0 이하일 때
 */
export function createBitFieldLayout(specs: readonly BitFieldSpec[]): BitFieldLayout {
  if (specs.length === 0) {
    throw new RangeError("BitFieldLayout: 최소 하나의 필드가 필요합니다");
  }

  let offset = 0;
  const fields: BitField[] = [];

  for (const s of specs) {
    const bits = s.bits ?? bitsForMax(s.maxValue);
    if (bits <= 0) {
      throw new RangeError(`BitFieldLayout: "${s.name}" 필드는 1비트 이상 필요합니다`);
    }
    fields.push(Object.freeze({
      name: s.name,
      bits,
      maxValue: (1n << BigInt(bits)) - 1n,
      offset,
    }));
    offset += bits;
  }

  return Object.freeze({
    fields: Object.freeze(fields),
    totalBits: offset,
    totalBytes: Math.ceil(offset / 8),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pack / Unpack → bigint
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 필드 값들을 하나의 bigint로 패킹.
 * MSB-first: 첫 번째 필드가 최상위 비트.
 * 각 값은 해당 필드 비트 폭으로 마스킹된다 (오버플로우 무시).
 */
export function bitPack(
  layout: BitFieldLayout,
  values: Readonly<Record<string, number | bigint>>,
): bigint {
  let result = 0n;
  for (const field of layout.fields) {
    const raw = values[field.name] ?? 0;
    const val = typeof raw === "bigint" ? raw : BigInt(raw);
    const shift = BigInt(layout.totalBits - field.offset - field.bits);
    result |= (val & field.maxValue) << shift;
  }
  return result;
}

/**
 * bigint를 필드 값들로 언패킹.
 */
export function bitUnpack(
  layout: BitFieldLayout,
  packed: bigint,
): Record<string, bigint> {
  const result: Record<string, bigint> = {};
  for (const field of layout.fields) {
    const shift = BigInt(layout.totalBits - field.offset - field.bits);
    result[field.name] = (packed >> shift) & field.maxValue;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Byte array conversion
// ═══════════════════════════════════════════════════════════════════════════

/** bigint → 고정 길이 Uint8Array (big-endian). */
export function bigintToBytes(value: bigint, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let v = value < 0n ? 0n : value;
  for (let i = byteLength - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xFFn);
    v >>= 8n;
  }
  return bytes;
}

/** Uint8Array → bigint (big-endian). */
export function bytesToBigint(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/** Pack → Uint8Array. */
export function bitPackToBytes(
  layout: BitFieldLayout,
  values: Readonly<Record<string, number | bigint>>,
): Uint8Array {
  return bigintToBytes(bitPack(layout, values), layout.totalBytes);
}

/** Uint8Array → Unpack. */
export function bitUnpackFromBytes(
  layout: BitFieldLayout,
  bytes: Uint8Array,
): Record<string, bigint> {
  return bitUnpack(layout, bytesToBigint(bytes));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Hex conversion (display / debug interop)
// ═══════════════════════════════════════════════════════════════════════════

/** Pack → hex 문자열 (⌈totalBits/4⌉ 자릿수, zero-padded). */
export function bitPackToHex(
  layout: BitFieldLayout,
  values: Readonly<Record<string, number | bigint>>,
): string {
  const packed = bitPack(layout, values);
  const hexChars = Math.ceil(layout.totalBits / 4);
  return packed.toString(16).padStart(hexChars, "0");
}

/** hex 문자열 → Unpack. dash/공백 자동 제거. */
export function bitUnpackFromHex(
  layout: BitFieldLayout,
  hex: string,
): Record<string, bigint> {
  const clean = hex.replace(/[-\s]/g, "").toLowerCase();
  return bitUnpack(layout, BigInt("0x" + (clean || "0")));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Analysis: bit vs hex 절약량 비교
// ═══════════════════════════════════════════════════════════════════════════

export interface BitVsHexField {
  name: string;
  maxValue: number;
  /** bit-level 필요 비트 수 */
  bitWidth: number;
  /** hex-level 필요 비트 수 (charsForMax × 4) */
  hexWidth: number;
  /** hexWidth - bitWidth */
  savedBits: number;
}

export interface BitVsHexAnalysis {
  fields: BitVsHexField[];
  totalBitWidth: number;
  totalHexWidth: number;
  savedBits: number;
  /** 회수된 비트로 얻는 용량 배수 (2^savedBits) */
  capacityMultiplier: number;
  /** 상대적 효율 개선 (savedBits / totalHexWidth) */
  efficiencyGain: number;
}

/**
 * bit-level 패킹과 hex-level 패킹의 비트 절약량 비교.
 *
 * @example
 * analyzeBitVsHex([
 *   { name: "prefix",  maxValue: 15 },    // 4b vs 4b → 0 saved
 *   { name: "version", maxValue: 7 },     // 3b vs 4b → 1 saved
 *   { name: "shard",   maxValue: 3 },     // 2b vs 4b → 2 saved
 *   { name: "index",   maxValue: 99999 }, // 17b vs 20b → 3 saved
 * ])
 * // → savedBits: 6, capacityMultiplier: 64
 */
export function analyzeBitVsHex(specs: readonly BitFieldSpec[]): BitVsHexAnalysis {
  const fields: BitVsHexField[] = specs.map(s => {
    const bitWidth = s.bits ?? bitsForMax(s.maxValue);
    // bits 명시 시 hex 폭은 비트 폭 기반으로 계산 (maxValue: 0 + bits: 119 같은 경우)
    const hexChars = s.bits != null
      ? Math.ceil(s.bits / 4)
      : charsForMax(s.maxValue);
    const hexWidth = hexChars * 4;
    return {
      name: s.name,
      maxValue: s.maxValue,
      bitWidth,
      hexWidth,
      savedBits: hexWidth - bitWidth,
    };
  });

  const totalBitWidth = fields.reduce((s, f) => s + f.bitWidth, 0);
  const totalHexWidth = fields.reduce((s, f) => s + f.hexWidth, 0);
  const savedBits = totalHexWidth - totalBitWidth;

  return {
    fields,
    totalBitWidth,
    totalHexWidth,
    savedBits,
    capacityMultiplier: savedBits > 0 ? 2 ** savedBits : 1,
    efficiencyGain: totalHexWidth > 0 ? savedBits / totalHexWidth : 0,
  };
}
