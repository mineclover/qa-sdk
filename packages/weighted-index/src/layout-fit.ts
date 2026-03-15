/**
 * layout-fit.ts — N-dimensional UUID layout simulator calculations.
 *
 * Pure functions for computing layout capacity, dimension limits,
 * and coordinate encoding/decoding for the interactive simulator.
 *
 * Architecture:
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  analyzeLayoutSim   — UUID 예산 분석 (index budget, max)     │
 *  │  dimMaxForBudget    — 한 차원의 최댓값 (다른 차원 고정 시)    │
 *  │  autoBalancedShape  — 균등 배분 초기 shape                   │
 *  │  simEncode/Decode   — 경량 mixed-radix 변환                  │
 *  │  simPackUUID        — 시뮬레이터용 UUID 패킹                  │
 *  └──────────────────────────────────────────────────────────────┘
 */

// ── Constants ────────────────────────────────────────────────────────────────

const UUID_CHARS = 32;
const SAFE_POW16_LIMIT = 13; // 16^13 < 2^53

// ── Types ────────────────────────────────────────────────────────────────────

export interface LayoutSimConfig {
  prefixChars: number;
  versionChars: number;
  shardChars: number;
  numDims: number;
}

export interface LayoutSimAnalysis {
  totalChars: number;
  usedChars: number;
  indexBudget: number;
  indexBits: number;
  maxProductDisplay: string;
  maxProductSafe: number;
  uniformMax: number;
  valid: boolean;
}

// ── Core analysis ────────────────────────────────────────────────────────────

/**
 * Analyze UUID layout capacity for N-dimensional indexing.
 *
 * @example
 * analyzeLayoutSim({ prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 3 })
 * // → { indexBudget: 29, uniformMax: 36028, ... }
 */
export function analyzeLayoutSim(cfg: LayoutSimConfig): LayoutSimAnalysis {
  const usedChars = cfg.prefixChars + cfg.versionChars + cfg.shardChars;
  const indexBudget = Math.max(0, UUID_CHARS - usedChars);
  const indexBits = indexBudget * 4;

  let maxProductSafe: number;
  let maxProductDisplay: string;

  if (indexBudget <= 0) {
    maxProductSafe = 0;
    maxProductDisplay = "0";
  } else if (indexBudget <= SAFE_POW16_LIMIT) {
    maxProductSafe = 16 ** indexBudget;
    maxProductDisplay = maxProductSafe.toLocaleString();
  } else {
    maxProductSafe = Number.MAX_SAFE_INTEGER;
    const exp = indexBudget * Math.log10(16);
    maxProductDisplay = `≈ 10^${exp.toFixed(1)} (16^${indexBudget})`;
  }

  const uniformMax =
    cfg.numDims > 0 && indexBudget > 0
      ? Math.max(1, Math.floor(Math.pow(16, indexBudget / cfg.numDims)))
      : 0;

  return {
    totalChars: UUID_CHARS,
    usedChars,
    indexBudget,
    indexBits,
    maxProductDisplay,
    maxProductSafe,
    uniformMax,
    valid: indexBudget > 0 && cfg.numDims > 0,
  };
}

// ── Dimension calculations ───────────────────────────────────────────────────

/**
 * Max value for a single dimension given the index hex budget
 * and the product of all OTHER dimensions' current values.
 *
 * Returns a safe JS number (capped at MAX_SAFE_INTEGER).
 * For display of the actual value, use dimMaxBig() or dimMaxApprox().
 */
export function dimMaxForBudget(indexBudget: number, productOfOthers: number): number {
  if (indexBudget <= 0 || productOfOthers <= 0) return 0;
  if (indexBudget <= SAFE_POW16_LIMIT) {
    return Math.floor(16 ** indexBudget / productOfOthers);
  }
  const logMax = indexBudget * Math.LN2 * 4 - Math.log(productOfOthers);
  if (logMax > Math.log(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.floor(Math.exp(logMax)));
}

/**
 * Exact max via BigInt → formatted display string.
 * Use this to show the TRUE max when it exceeds MAX_SAFE_INTEGER.
 */
export function dimMaxBig(indexBudget: number, productOfOthers: number): string {
  if (indexBudget <= 0 || productOfOthers <= 0) return "0";
  const maxProduct = 16n ** BigInt(indexBudget);
  const others = BigInt(Math.round(productOfOthers));
  if (others <= 0n) return "0";
  const result = maxProduct / others;
  return formatBigInt(result);
}

/**
 * Float approximation of dimMax (can exceed MAX_SAFE_INTEGER).
 * NOT safe for integer math — only for log-scale graph calculations.
 */
export function dimMaxApprox(indexBudget: number, productOfOthers: number): number {
  if (indexBudget <= 0 || productOfOthers <= 0) return 0;
  if (indexBudget <= SAFE_POW16_LIMIT) {
    return Math.floor(16 ** indexBudget / productOfOthers);
  }
  return Math.exp(indexBudget * Math.LN2 * 4 - Math.log(productOfOthers));
}

function formatBigInt(n: bigint): string {
  if (n <= 0n) return "0";
  if (n < 1_000_000n) return Number(n).toLocaleString();
  const s = n.toString();
  const exp = s.length - 1;
  const mantissa = s[0] + "." + s.slice(1, 3);
  return `${mantissa} × 10^${exp}`;
}

/** Product of all shape values except the excluded index. */
export function productExcluding(shape: readonly number[], excludeIndex: number): number {
  let p = 1;
  for (let i = 0; i < shape.length; i++) {
    if (i !== excludeIndex) {
      p *= shape[i];
      if (p > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
    }
  }
  return p;
}

/** Product of all shape values. */
export function shapeProduct(shape: readonly number[]): number {
  let p = 1;
  for (const s of shape) {
    p *= s;
    if (p > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return p;
}

/**
 * Generate a balanced shape where all dimensions have equal size.
 * Uses floor(16^(budget/numDims)) for each dimension.
 */
export function autoBalancedShape(numDims: number, indexBudget: number): number[] {
  if (numDims <= 0 || indexBudget <= 0) return [];
  const base = Math.max(2, Math.floor(Math.pow(16, indexBudget / numDims)));
  return new Array(numDims).fill(base);
}

// ── Lightweight encode/decode ────────────────────────────────────────────────

/** Mixed-radix decode: index → 1-based coordinates. No validation. */
export function simDecode(shape: readonly number[], index: number): number[] {
  const n = shape.length;
  const coords = new Array(n);
  let rest = index;
  for (let i = n - 1; i >= 0; i--) {
    coords[i] = (rest % shape[i]) + 1;
    rest = Math.floor(rest / shape[i]);
  }
  return coords;
}

/** Mixed-radix encode: 1-based coordinates → index. No validation. */
export function simEncode(shape: readonly number[], coords: readonly number[]): number {
  let index = 0;
  let weight = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    index += (coords[i] - 1) * weight;
    weight *= shape[i];
  }
  return index;
}

// ── UUID packing ─────────────────────────────────────────────────────────────

/**
 * Pack prefix/version/shard/index values into a UUID hex string.
 *
 * Layout: [prefix][version][...gap...][shard][index]
 *          ←── left ──→              ←── right ──→
 */
export function simPackUUID(
  prefixChars: number,
  prefixVal: number,
  versionChars: number,
  versionVal: number,
  shardChars: number,
  shardVal: number,
  indexVal: number,
): string {
  const chars = new Array(UUID_CHARS).fill("0");

  // Left side: prefix then version
  _writeHex(chars, 0, prefixChars, prefixVal);
  _writeHex(chars, prefixChars, versionChars, versionVal);

  // Right side: index (rightmost), then shard (next inward)
  const indexChars = UUID_CHARS - prefixChars - versionChars - shardChars;
  if (indexChars > 0) {
    _writeHex(chars, UUID_CHARS - indexChars, indexChars, indexVal);
  }
  if (shardChars > 0) {
    _writeHex(chars, UUID_CHARS - indexChars - shardChars, shardChars, shardVal);
  }

  const raw = chars.join("");
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
    raw.slice(16, 20),
    raw.slice(20, 32),
  ].join("-");
}

function _writeHex(arr: string[], start: number, width: number, value: number): void {
  if (width <= 0) return;
  // Cap value to the field's max capacity (16^width - 1)
  const maxVal = 16 ** width - 1;
  const capped = Math.min(Math.max(0, Math.floor(value)), maxVal);
  const hex = capped.toString(16).padStart(width, "0");
  for (let i = 0; i < width; i++) {
    if (start + i < arr.length) arr[start + i] = hex[i];
  }
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** Format a potentially large number for display. */
export function formatLargeNumber(n: number): string {
  if (n <= 0) return "0";
  if (n < 1_000_000) return n.toLocaleString();
  const exp = Math.floor(Math.log10(n));
  const mantissa = n / Math.pow(10, exp);
  return `${mantissa.toFixed(2)} × 10^${exp}`;
}

// ── BigInt-aware helpers (for Number/BigInt mode toggle) ─────────────────────

/** Exact max product via BigInt. */
export function maxProductBig(indexBudget: number): bigint {
  if (indexBudget <= 0) return 0n;
  return 16n ** BigInt(indexBudget);
}

/** Uncapped shape product (may exceed MAX_SAFE_INTEGER; OK for log-scale UI). */
export function shapeProductUncapped(shape: readonly number[]): number {
  return shape.reduce((p, s) => p * s, 1);
}

/**
 * BigInt-based utilization: exact ratio of float product to true max capacity.
 * Returns percentage (0–100+).
 * Product is converted from float (lossy for > 2^53 but acceptable for display).
 */
export function utilizationBig(approxProduct: number, indexBudget: number): number {
  if (indexBudget <= 0 || approxProduct <= 0) return 0;
  const maxP = 16n ** BigInt(indexBudget);
  const prodBig = BigInt(Math.round(approxProduct));
  return Number(prodBig * 1000000n / maxP) / 10000;
}
