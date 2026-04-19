// @def.boundary weighted-index-system
// @def.doc weighted-index-system

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
  /** 포맷 전체 hex chars. 미지정 시 32 (UUID). */
  formatChars?: number;
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
  const totalChars = cfg.formatChars ?? UUID_CHARS;
  const usedChars = cfg.prefixChars + cfg.versionChars + cfg.shardChars;
  const indexBudget = Math.max(0, totalChars - usedChars);
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
    totalChars,
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
  // Budget exceeds JS safe integer range — cap effective capacity at MAX_SAFE_INTEGER
  // so that the total product of all dims stays representable as a Number.
  if (productOfOthers >= Number.MAX_SAFE_INTEGER) return 1;
  return Math.max(1, Math.floor(Number.MAX_SAFE_INTEGER / productOfOthers));
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

/**
 * Shape를 상호 제약에 맞게 clamp.
 * 각 dim의 값이 다른 dim 값에 의해 결정되는 dimMax를 초과하면 줄인다.
 * BigInt 모드에서는 BigInt 연산으로 정확한 clamp를 수행한다.
 * 상호 의존이므로 수렴할 때까지 반복 (최대 passes회).
 */
export function clampShape(
  shape: readonly number[],
  indexBudget: number,
  mode: LayoutViewMode,
  passes = 3,
): number[] {
  const result = [...shape];

  if (mode === "bigint" && indexBudget > SAFE_POW16_LIMIT) {
    // BigInt 모드: 정확한 BigInt 연산으로 clamp
    const maxProduct = 16n ** BigInt(indexBudget);
    for (let p = 0; p < passes; p++) {
      let changed = false;
      for (let i = 0; i < result.length; i++) {
        let othersBig = 1n;
        for (let j = 0; j < result.length; j++) {
          if (j !== i) othersBig *= BigInt(Math.round(result[j]));
        }
        if (othersBig <= 0n) continue;
        const dmax = maxProduct / othersBig;
        const dmaxNum = dmax < BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(dmax)
          : Number(dmax / 1000000n) * 1000000; // 큰 값은 float 근사
        const clamped = Math.max(1, Math.min(result[i], Math.floor(dmaxNum)));
        if (clamped !== result[i]) {
          result[i] = clamped;
          changed = true;
        }
      }
      if (!changed) break;
    }
  } else {
    // Number 모드: 기존 dimMaxForBudget 사용
    for (let p = 0; p < passes; p++) {
      let changed = false;
      for (let i = 0; i < result.length; i++) {
        const others = productExcluding(result, i);
        const dmax = dimMaxForBudget(indexBudget, others);
        const clamped = Math.max(1, Math.min(result[i], Math.floor(dmax)));
        if (clamped !== result[i]) {
          result[i] = clamped;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
  return result;
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

/** Product of all shape values except the excluded index (uncapped float). */
function productExcludingUncapped(shape: readonly number[], excludeIndex: number): number {
  let p = 1;
  for (let i = 0; i < shape.length; i++) {
    if (i !== excludeIndex) p *= shape[i];
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

/**
 * 범용 hex pack: totalChars 길이의 raw hex 문자열 반환 (dash 없음).
 * formatHex()와 조합하여 포맷별 출력을 만든다.
 */
export function simPackHex(
  totalChars: number,
  prefixChars: number,
  prefixVal: number,
  versionChars: number,
  versionVal: number,
  shardChars: number,
  shardVal: number,
  indexVal: number,
): string {
  const chars = new Array(totalChars).fill("0");
  _writeHex(chars, 0, prefixChars, prefixVal);
  _writeHex(chars, prefixChars, versionChars, versionVal);
  const indexChars = totalChars - prefixChars - versionChars - shardChars;
  if (indexChars > 0) {
    _writeHex(chars, totalChars - indexChars, indexChars, indexVal);
  }
  if (shardChars > 0) {
    _writeHex(chars, totalChars - indexChars - shardChars, shardChars, shardVal);
  }
  return chars.join("");
}

/** BigInt 범용 hex pack: totalChars 길이의 raw hex 문자열 반환 (dash 없음). */
export function simPackHexBig(
  totalChars: number,
  prefixChars: number,
  prefixVal: number,
  versionChars: number,
  versionVal: number,
  shardChars: number,
  shardVal: number,
  indexVal: bigint,
): string {
  const indexChars = totalChars - prefixChars - versionChars - shardChars;
  let full = 0n;
  if (prefixChars > 0)
    full |= BigInt(prefixVal) << BigInt((totalChars - prefixChars) * 4);
  if (versionChars > 0)
    full |= BigInt(versionVal) << BigInt((totalChars - prefixChars - versionChars) * 4);
  if (shardChars > 0)
    full |= BigInt(shardVal) << BigInt(indexChars * 4);
  if (indexChars > 0) {
    const mask = (1n << BigInt(indexChars * 4)) - 1n;
    full |= indexVal & mask;
  }
  return full.toString(16).padStart(totalChars, "0");
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

// ── BigInt encode/decode/pack ────────────────────────────────────────────────

/** BigInt mixed-radix decode: index → 1-based coordinates. */
export function simDecodeBig(shape: readonly bigint[], index: bigint): bigint[] {
  const n = shape.length;
  const coords = new Array<bigint>(n);
  let rest = index;
  for (let i = n - 1; i >= 0; i--) {
    coords[i] = (rest % shape[i]) + 1n;
    rest = rest / shape[i];
  }
  return coords;
}

/** BigInt mixed-radix encode: 1-based coordinates → index. */
export function simEncodeBig(shape: readonly bigint[], coords: readonly bigint[]): bigint {
  let index = 0n;
  let weight = 1n;
  for (let i = shape.length - 1; i >= 0; i--) {
    index += (coords[i] - 1n) * weight;
    weight *= shape[i];
  }
  return index;
}

/** BigInt UUID pack: 128bit를 하나의 BigInt로 조합 후 hex 포맷. */
export function simPackUUIDBig(
  prefixChars: number,
  prefixVal: number,
  versionChars: number,
  versionVal: number,
  shardChars: number,
  shardVal: number,
  indexVal: bigint,
): string {
  const indexChars = UUID_CHARS - prefixChars - versionChars - shardChars;
  let full = 0n;

  if (prefixChars > 0)
    full |= BigInt(prefixVal) << BigInt((UUID_CHARS - prefixChars) * 4);
  if (versionChars > 0)
    full |= BigInt(versionVal) << BigInt((UUID_CHARS - prefixChars - versionChars) * 4);
  if (shardChars > 0)
    full |= BigInt(shardVal) << BigInt(indexChars * 4);
  if (indexChars > 0) {
    const mask = (1n << BigInt(indexChars * 4)) - 1n;
    full |= indexVal & mask;
  }

  const hex = full.toString(16).padStart(UUID_CHARS, "0");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// ── Display & UI helpers ────────────────────────────────────────────────────

/** N hex chars 필드의 최대값. fieldMaxVal(2) → 255. */
export function fieldMaxVal(chars: number): number {
  return chars > 0 ? 16 ** chars - 1 : 0;
}

/** Log-scale percentage: val이 [1..max] 범위에서 차지하는 비율 (0–100). */
export function logScalePercent(val: number, max: number): number {
  if (max <= 1 || val <= 1) return 0;
  return Math.min(100, Math.log(val) / Math.log(max) * 100);
}

/** Log-scale 슬라이더 position(0–resolution) → 실제 값(1–dmax). */
export function sliderToVal(pos: number, dmax: number, resolution = 1000): number {
  if (dmax <= 1) return 1;
  return Math.max(1, Math.round(Math.pow(dmax, pos / resolution)));
}

/** 실제 값(1–dmax) → log-scale 슬라이더 position(0–resolution). */
export function valToSlider(val: number, dmax: number, resolution = 1000): number {
  if (dmax <= 1) return 0;
  const clamped = Math.max(1, Math.min(val, dmax));
  return Math.round(Math.log(clamped) / Math.log(dmax) * resolution);
}

/** Protobuf varint 인코딩 시 바이트 수 추정. */
export function varintByteSize(n: number): number {
  if (n < 0) return 1;
  let s = 1;
  let v = n;
  while (v >= 128) { v >>>= 7; s++; }
  return s;
}

/** Format a potentially large number for display. */
export function formatLargeNumber(n: number): string {
  if (n <= 0) return "0";
  if (n < 1_000_000) return n.toLocaleString();
  const exp = Math.floor(Math.log10(n));
  const mantissa = n / Math.pow(10, exp);
  return `${mantissa.toFixed(2)} × 10^${exp}`;
}

// ── LayoutViewModel ─────────────────────────────────────────────────────────
//
// UI가 모드별로 정합성 있는 수치를 표시하기 위한 단일 출력 구조.
// 모든 수치는 effectiveMax를 기준으로 계산되므로 모순이 없다.

export type LayoutViewMode = "number" | "bigint";

export interface DimViewModel {
  index: number;
  value: number;
  sliderMax: number;       // 슬라이더가 도달 가능한 최대값
  displayMax: string;      // sliderMax의 포맷 문자열
}

export interface LayoutViewModel {
  mode: LayoutViewMode;
  indexBudget: number;
  indexBits: number;

  // 인덱스 타입 자동 결정: indexBudget > 13 → bigint 필수
  indexType: "number" | "bigint";

  // 모드별 유효 최대 용량
  effectiveMax: number;            // Number 기준 (Number 모드에서 연산에 사용)
  effectiveMaxDisplay: string;
  isCapped: boolean;               // Number 모드에서 MAX_SAFE_INTEGER 캡 적용 여부
  uuidCapacityDisplay: string;     // 항상 실제 포맷 용량 (16^budget)

  dims: DimViewModel[];

  product: number;
  productDisplay: string;
  utilization: number;              // 0-100+, effectiveMax 기준
  utilizationDisplay: string;
  overflow: boolean;

  capacityNote: string | null;     // isCapped일 때 실제 용량 안내

  // Number 갭: index 영역 중 Number로 도달 불가능한 비트 수
  numberReachBits: number;         // Number로 도달 가능한 비트 (≈53)
  numberGapBits: number;           // index 영역 중 도달 불가 비트

  // index 영역 사용률: 구조 바 오버레이용 (0~1)
  indexFillRatio: number;
}

/**
 * config + shape + mode → 정합성 있는 ViewModel 한 벌.
 *
 * Number 모드: effectiveMax = min(16^budget, MAX_SAFE_INTEGER)
 * BigInt 모드: effectiveMax = 16^budget (float 근사)
 */
export function computeLayoutViewModel(
  analysis: LayoutSimAnalysis,
  shape: readonly number[],
  mode: LayoutViewMode,
): LayoutViewModel {
  const { indexBudget, indexBits } = analysis;

  // effectiveMax 결정
  let effectiveMax: number;
  let effectiveMaxDisplay: string;
  let isCapped: boolean;

  if (indexBudget <= 0) {
    effectiveMax = 0;
    effectiveMaxDisplay = "0";
    isCapped = false;
  } else if (mode === "bigint") {
    // BigInt 모드: UUID 전체 용량 (float 근사)
    effectiveMax = indexBudget <= SAFE_POW16_LIMIT
      ? 16 ** indexBudget
      : Math.exp(indexBudget * Math.LN2 * 4);
    effectiveMaxDisplay = analysis.maxProductDisplay;
    isCapped = false;
  } else {
    // Number 모드: MAX_SAFE_INTEGER 캡
    if (indexBudget <= SAFE_POW16_LIMIT) {
      effectiveMax = 16 ** indexBudget;
      isCapped = false;
    } else {
      effectiveMax = Number.MAX_SAFE_INTEGER;
      isCapped = true;
    }
    effectiveMaxDisplay = formatLargeNumber(effectiveMax);
  }

  // shape를 상호 제약에 맞게 clamp (오버플로우 방지)
  const clamped = clampShape(shape, indexBudget, mode);

  // Per-dim 계산: clamp된 shape 기준
  const dims: DimViewModel[] = clamped.map((value, i) => {
    // BigInt 모드: uncapped float로 정확한 others 계산
    // Number 모드: capped productExcluding 사용
    const others = mode === "bigint"
      ? productExcludingUncapped(clamped, i)
      : productExcluding(clamped, i);
    let sliderMax: number;
    let displayMax: string;

    if (mode === "bigint") {
      sliderMax = Math.max(1, dimMaxApprox(indexBudget, others));
      displayMax = dimMaxBig(indexBudget, Math.round(others));
    } else {
      sliderMax = Math.max(1, dimMaxForBudget(indexBudget, others));
      displayMax = formatLargeNumber(sliderMax);
    }

    return { index: i, value, sliderMax, displayMax };
  });

  // Product & utilization — effectiveMax 기준 (clamp된 shape)
  const product = mode === "bigint"
    ? shapeProductUncapped(clamped)
    : shapeProduct(clamped);
  const productDisplay = formatLargeNumber(product);

  let utilization: number;
  if (mode === "bigint") {
    utilization = utilizationBig(product, indexBudget);
  } else {
    utilization = effectiveMax > 0 ? (product / effectiveMax * 100) : 0;
  }

  const utilizationDisplay = utilization < 0.01 && product > 0
    ? "< 0.01%"
    : utilization.toFixed(2) + "%";

  const capacityNote = isCapped
    ? `실제 포맷 용량: ${analysis.maxProductDisplay}`
    : null;

  // 인덱스 타입 자동 결정
  const indexType: "number" | "bigint" = indexBudget > SAFE_POW16_LIMIT ? "bigint" : "number";

  // Number 갭 계산: MAX_SAFE_INTEGER = 2^53 → 53bit
  const numberReachBits = isCapped ? 53 : indexBits;
  const numberGapBits = isCapped ? indexBits - 53 : 0;

  // index 영역 사용률 (구조 바 오버레이용)
  const indexFillRatio = effectiveMax > 0 ? Math.min(1, product / effectiveMax) : 0;

  return {
    mode,
    indexBudget,
    indexBits,
    indexType,
    effectiveMax,
    effectiveMaxDisplay,
    isCapped,
    uuidCapacityDisplay: analysis.maxProductDisplay,
    dims,
    product,
    productDisplay,
    utilization,
    utilizationDisplay,
    overflow: utilization > 100,
    capacityNote,
    numberReachBits,
    numberGapBits,
    indexFillRatio,
  };
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
