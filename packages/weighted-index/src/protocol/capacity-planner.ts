// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * capacity-planner.ts — Pure geometry/capacity algorithms.
 *
 * Architecture:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  fitShape            — 용량 맞춤 shape 축소              │
 *  │  fitLayout           — fitShape + planLayout combined    │
 *  │  planCapacity        — growth-aware capacity 추천        │
 *  └──────────────────────────────────────────────────────────┘
 *
 * Extension:
 *   fitShape({ shape: [99999, 999, 99, 99], maxProduct: 16 ** 7 })
 *   fitLayout({ shape, left, capacity: reg.get("cuid") });
 *   planCapacity({ dims, left, capacity: "uuid" });
 */

import { charsForMax, planLayout, type LayoutFieldSpec, type LayoutPlan } from "./uuid-layout.js";
import {
  defineFormat,
  hexBoundary,
  PACK_FORMATS,
  type BuiltinFormatName,
  type HexBoundary,
  type PackFormat,
} from "./pack-format.js";

// ═══════════════════════════════════════════════════════════════════════════
//  fitShape — proportional downscale to fit max product
// ═══════════════════════════════════════════════════════════════════════════

export interface FitShapeOptions {
  /** 원본 차원 크기 배열 */
  shape: readonly number[];
  /** 허용 최대 곱 (= max index + 1) */
  maxProduct: number;
  /** 차원별 최솟값. 숫자 하나면 모든 차원에 적용, 배열이면 개별 적용. (기본 1) */
  min?: number | readonly number[];
  /** 축소 대상에서 제외할 차원 인덱스 */
  fixed?: ReadonlySet<number>;
}

export interface FitShapeResult {
  /** 조정된 shape */
  shape: number[];
  /** 결과 곱 (= product of shape) */
  product: number;
  /** 활용률: product / maxProduct (0~1) */
  utilization: number;
  /** 각 차원의 hex 경계 분석 */
  boundaries: HexBoundary[];
}

/**
 * Scale down a shape so that its product fits within maxProduct.
 *
 * Algorithm:
 *  1. Proportional scaling: ratio = (maxProduct / currentProduct)^(1/freeDims)
 *  2. Floor each dim, respecting min constraints and fixed dims
 *  3. Greedy fill: increase dims one-by-one (largest original first)
 *     while product ≤ maxProduct, capped at original value
 *
 * Returns null if the shape already fits (no adjustment needed).
 *
 * @example
 * fitShape({ shape: [99999, 999, 99, 99], maxProduct: 16 ** 7 })
 */
export function fitShape(opts: FitShapeOptions): FitShapeResult | null {
  const { shape, maxProduct, fixed } = opts;
  const n = shape.length;
  if (n === 0 || maxProduct < 1) return null;

  const minArr = resolveMin(opts.min, n);
  const currentProduct = shape.reduce((a, b) => a * b, 1);
  if (currentProduct <= maxProduct) return null;

  const freeIndices = [];
  for (let i = 0; i < n; i++) {
    if (!fixed?.has(i)) freeIndices.push(i);
  }

  const result = shape.map((s, i) => Math.max(minArr[i], s));

  const fixedProduct = result.reduce((a, s, i) => fixed?.has(i) ? a * s : a, 1);
  const freeMaxProduct = Math.floor(maxProduct / fixedProduct);
  if (freeMaxProduct < 1) return null;

  const freeCurrentProduct = freeIndices.reduce((a, i) => a * result[i], 1);
  const ratio = Math.pow(freeMaxProduct / freeCurrentProduct, 1 / freeIndices.length);

  for (const i of freeIndices) {
    result[i] = Math.max(minArr[i], Math.floor(result[i] * ratio));
  }

  let product = result.reduce((a, s) => a * s, 1);
  if (product > maxProduct) {
    const descFree = [...freeIndices].toSorted((a, b) => result[b] - result[a]);
    while (product > maxProduct) {
      let reduced = false;
      for (const i of descFree) {
        if (result[i] > minArr[i]) {
          result[i]--;
          product = result.reduce((a, s) => a * s, 1);
          reduced = true;
          if (product <= maxProduct) break;
        }
      }
      if (!reduced) return null;
    }
  }

  const priority = [...freeIndices].toSorted((a, b) => shape[b] - shape[a]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of priority) {
      if (result[i] >= shape[i]) continue;
      const next = result.reduce((a, s, j) => a * (j === i ? s + 1 : s), 1);
      if (next <= maxProduct) {
        result[i]++;
        product = next;
        changed = true;
      }
    }
  }

  product = result.reduce((a, s) => a * s, 1);
  return {
    shape:       result,
    product,
    utilization: product / maxProduct,
    boundaries:  result.map(hexBoundary),
  };
}

function resolveMin(min: number | readonly number[] | undefined, n: number): number[] {
  if (min == null) return new Array(n).fill(1);
  if (typeof min === "number") return new Array(n).fill(Math.max(1, min));
  return Array.from({ length: n }, (_, i) => Math.max(1, min[i] ?? 1));
}

// ═══════════════════════════════════════════════════════════════════════════
//  fitLayout — fitShape + planLayout combined
// ═══════════════════════════════════════════════════════════════════════════

export interface FitLayoutOptions {
  /** 원본 차원 크기 배열 */
  shape: readonly number[];
  /** prefix, version 등 left 필드 스펙 */
  left: LayoutFieldSpec[];
  /**
   * 대상 포맷.
   *  - `PackFormat` 객체: 직접 전달 (커스텀 포맷 포함)
   *  - `number`: hex chars 수 (익명 포맷)
   *  - `BuiltinFormatName`: built-in 이름 ("uuid", "int64", …)
   */
  capacity: PackFormat | number | BuiltinFormatName;
  /** 차원별 최솟값 */
  min?: number | readonly number[];
  /** 축소 대상에서 제외할 차원 인덱스 */
  fixed?: ReadonlySet<number>;
}

export interface FitLayoutResult extends FitShapeResult {
  /** 조정된 shape 기반의 planLayout 결과 */
  plan: LayoutPlan;
  /** 사용된 포맷 */
  format: PackFormat;
  /** index 필드에 사용 가능한 hex 자릿수 */
  indexBudget: number;
}

function resolveBuiltinCapacity(cap: PackFormat | number | string): PackFormat {
  if (typeof cap === "object") return cap;
  if (typeof cap === "number") {
    return defineFormat({ name: `${cap * 4}bit`, chars: cap, label: `${cap * 4}-bit` });
  }
  const fmt = (PACK_FORMATS as Record<string, PackFormat>)[cap];
  if (!fmt) throw new RangeError(`Unknown built-in format: "${cap}"`);
  return fmt;
}

/**
 * Fit a shape into a target format's capacity, then plan the layout.
 *
 * Returns null when the shape cannot be accommodated. Possible reasons:
 * - Left fields (schema, version, etc.) consume all available hex chars,
 *   leaving no budget for the index field (`indexBudget <= 0`).
 * - The shape product exceeds `16^indexBudget` and `fitShape` cannot
 *   reduce dimensions to fit (e.g., all dimensions are already at their
 *   minimum or fixed).
 * - The original shape already fits but `fitShape` returns null (no
 *   adjustment needed) and then the product still exceeds capacity --
 *   this path returns null when `product > maxProduct`.
 *
 * @returns The fitted layout result, or null if the shape cannot fit.
 *
 * @example
 * // built-in name
 * fitLayout({ shape, left, capacity: "int64" })
 * // PackFormat object (custom)
 * fitLayout({ shape, left, capacity: defineFormat({ name: "x", chars: 20, label: "X" }) })
 * // raw number
 * fitLayout({ shape, left, capacity: 16 })
 */
export function fitLayout(opts: FitLayoutOptions): FitLayoutResult | null {
  const format = resolveBuiltinCapacity(opts.capacity);
  const capacity = format.chars;

  const leftChars = opts.left.reduce((s, f) => {
    return s + (f.chars ?? charsForMax(f.maxValue ?? 0));
  }, 0);

  const indexBudget = capacity - leftChars;
  if (indexBudget <= 0) return null;

  const maxProduct = Math.pow(16, indexBudget);

  const fit = fitShape({
    shape:      opts.shape,
    maxProduct,
    min:        opts.min,
    fixed:      opts.fixed,
  });

  if (!fit) {
    const product = opts.shape.reduce((a, b) => a * b, 1);
    if (product > maxProduct) return null;

    const plan = planLayout({
      left:  opts.left,
      right: [{ name: "index", maxValue: product - 1 }],
    });

    return {
      shape:       [...opts.shape],
      product,
      utilization: product / maxProduct,
      boundaries:  opts.shape.map(hexBoundary),
      plan,
      format,
      indexBudget,
    };
  }

  const plan = planLayout({
    left:  opts.left,
    right: [{ name: "index", maxValue: fit.product - 1 }],
  });

  return { ...fit, plan, format, indexBudget };
}

// ═══════════════════════════════════════════════════════════════════════════
//  planCapacity — growth-aware capacity recommendation
// ═══════════════════════════════════════════════════════════════════════════

export interface CapacityPlanDim {
  name: string;
  /** 현재 entry 수 (실제 정의된 항목 수) */
  current: number;
  /**
   * 예상 추가 entry 수.
   * 미지정 시 current와 동일 (= 2배 headroom).
   * 0이면 추가 여유 없음 (current → nextPow2).
   */
  growth?: number;
}

export interface PlanCapacityOptions {
  dims: CapacityPlanDim[];
  /** prefix, version 등 left 필드 스펙 */
  left: LayoutFieldSpec[];
  /** 대상 포맷 */
  capacity: PackFormat | number | BuiltinFormatName;
  /** 샤딩 자릿수 (기본 0) */
  shardChars?: number;
}

export interface CapacityRecommendation {
  name: string;
  current: number;
  /** 예상 추가 수 (입력 또는 기본값) */
  growth: number;
  /** 권장 capacity (current + growth → nextPow2 정렬) */
  recommended: number;
  /** recommended가 사용하는 hex 자릿수 */
  hexChars: number;
  /** 여유율: (recommended - current) / recommended */
  headroom: number;
}

export interface CapacityPlanResult {
  dims: CapacityRecommendation[];
  /** 권장 capacity들의 배열 */
  shape: number[];
  /** shape의 곱 */
  product: number;
  /** 포맷에 적합한지 */
  fits: boolean;
  /** index 필드 hex 자릿수 예산 */
  indexBudget: number;
  /** product / maxProduct */
  utilization: number;
  /**
   * 변동성이 높은 dim이 있어 샤딩 권장.
   * growth/current > 1.0인 dim이 하나라도 있으면 true.
   */
  shardingAdvised: boolean;
  /** 레이아웃 계획 */
  plan: LayoutPlan;
  format: PackFormat;
}

/** 2의 거듭제곱으로 올림 (hex 친화적 단위). 최소 1. */
function nextPow2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * current + growth → nextPow2 정렬.
 *
 * @example
 * recommendDim(5, 3)   // 5+3=8  → nextPow2 → 8
 * recommendDim(20, 5)  // 20+5=25 → nextPow2 → 32
 * recommendDim(16, 0)  // 16+0=16 → nextPow2 → 16
 * recommendDim(5, 5)   // 5+5=10 → nextPow2 → 16
 */
function recommendDim(current: number, growth: number): number {
  const target = Math.max(1, current) + Math.max(0, growth);
  return nextPow2(target);
}

/**
 * 차원별 현재 entry 수와 예상 성장량을 기반으로 최적 capacity를 제안한다.
 *
 * ── 알고리즘 ──────────────────────────────────────────────────────────────
 *
 * 1. 각 차원에 current + growth → nextPow2 적용
 * 2. 포맷 예산 초과 시 fitShape로 축소 (current를 min으로 보호)
 * 3. growth/current > 1.0인 dim이 있으면 샤딩 권장
 *
 * ── 2의 거듭제곱 정렬 ────────────────────────────────────────────────────
 *
 * 2의 거듭제곱은 hex 자릿수 경계와 자연스럽게 정렬된다:
 *   16=0x10 (1자리), 256=0x100 (2자리), 4096=0x1000 (3자리)
 * 그 사이 값(32, 64, 128 등)도 같은 hex 자릿수 내에서 깔끔하게 배분된다.
 *
 * @param opts.dims - 차원별 현재 entry 수와 성장 예측.
 * @param opts.dims[].growth - 예상 최대 크기. 미지정 시 current의 2배(2x headroom)가 적용됩니다.
 *   즉 growth 기본값은 current와 동일하므로, recommended는 nextPow2(current + current)가 됩니다.
 * @param opts.left - prefix, version 등 left 필드 스펙.
 * @param opts.capacity - 대상 포맷 (PackFormat | number | BuiltinFormatName).
 * @param opts.shardChars - 샤딩 자릿수 (기본 0).
 *
 * @example
 * planCapacity({
 *   dims: [
 *     { name: "role",     current: 5, growth: 3 },   // 5+3=8   → 8
 *     { name: "action",   current: 8, growth: 0 },   // 8+0=8   → 8
 *     { name: "resource", current: 3, growth: 10 },  // 3+10=13 → 16, 샤딩 권장
 *   ],
 *   left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
 *   capacity: "uuid",
 * })
 * // → shape: [8, 8, 16], product: 1024, fits: true, shardingAdvised: true
 */
export function planCapacity(opts: PlanCapacityOptions): CapacityPlanResult {
  const format = resolveBuiltinCapacity(opts.capacity);
  const shardChars = opts.shardChars ?? 0;

  const leftChars = opts.left.reduce(
    (s, f) => s + (f.chars ?? charsForMax(f.maxValue ?? 0)),
    0
  ) + shardChars;

  const indexBudget = format.chars - leftChars;
  const maxProduct = indexBudget > 0 ? Math.pow(16, indexBudget) : 0;

  // 1. current + growth → nextPow2
  const growths = opts.dims.map((d) => d.growth ?? d.current); // 미지정 시 current (= 2배 headroom)
  const rawRecommended = opts.dims.map((d, i) => recommendDim(d.current, growths[i]));

  let shape = [...rawRecommended];
  let product = shape.reduce((a, b) => a * b, 1);

  // 2. 예산 초과 시 fitShape로 축소 (current를 min으로 보호)
  if (product > maxProduct && maxProduct > 0) {
    const mins = opts.dims.map((d) => Math.max(1, d.current));
    const fit = fitShape({ shape, maxProduct, min: mins });
    if (fit) {
      // fitShape 결과를 2의 거듭제곱으로 내림 정렬 (min 이상 보장)
      shape = fit.shape.map((s, i) => {
        const p2 = nextPow2down(s);
        return Math.max(mins[i], p2);
      });
      product = shape.reduce((a, b) => a * b, 1);
      // 다시 초과하면 fitShape 결과를 그대로 사용
      if (product > maxProduct) {
        shape = fit.shape;
        product = fit.product;
      }
    }
  }

  const fits = maxProduct > 0 && product <= maxProduct;

  // 3. dim별 추천 정보
  const dims: CapacityRecommendation[] = opts.dims.map((d, i) => {
    const rec = shape[i];
    const b = hexBoundary(rec);
    return {
      name: d.name,
      current: d.current,
      growth: growths[i],
      recommended: rec,
      hexChars: b.hexChars,
      headroom: rec > 0 ? (rec - d.current) / rec : 0,
    };
  });

  // 4. 샤딩 권장: growth/current > 1.0인 dim이 있으면
  const shardingAdvised = opts.dims.some((d, i) =>
    d.current > 0 && growths[i] / d.current > 1.0
  );

  // 5. 레이아웃 계획
  const plan = planLayout({
    left: opts.left,
    right: [{ name: "index", maxValue: Math.max(0, product - 1) }],
  });

  return {
    dims,
    shape,
    product,
    fits,
    indexBudget,
    utilization: maxProduct > 0 ? product / maxProduct : 0,
    shardingAdvised,
    plan,
    format,
  };
}

/** 2의 거듭제곱으로 내림. 최소 1. */
function nextPow2down(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.floor(Math.log2(n)));
}
