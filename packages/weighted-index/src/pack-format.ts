/**
 * pack-format.ts — Named ID container formats, registry, and shape-fitting.
 *
 * Architecture:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  PackFormat          — 포맷 정의 (chars, groups, …)      │
 *  │  FormatRegistry      — 포맷 등록/조회/열거               │
 *  │  defineFormat()      — 검증 팩토리                       │
 *  │  formatHex/parseHex  — 포맷별 dash 그룹 직렬화           │
 *  │  hexBoundary/ceil/floor — hex 자릿수 경계 분석           │
 *  │  fitShape/fitLayout  — 용량 맞춤 shape 축소              │
 *  └──────────────────────────────────────────────────────────┘
 *
 * Extension:
 *   const reg = createFormatRegistry();          // built-ins 포함
 *   reg.register(defineFormat({ name: "cuid", chars: 20, label: "CUID" }));
 *   fitLayout({ shape, left, capacity: reg.get("cuid") });
 */

import { charsForMax, planLayout, type LayoutFieldSpec, type LayoutPlan } from "./uuid-layout.js";

// ═══════════════════════════════════════════════════════════════════════════
//  PackFormat — 포맷 정의
// ═══════════════════════════════════════════════════════════════════════════

export interface PackFormat {
  /** 고유 식별 이름 */
  readonly name:   string;
  /** hex 자릿수 (dash 제외) */
  readonly chars:  number;
  /** 비트 수 (= chars × 4) */
  readonly bits:   number;
  /** 사람이 읽을 수 있는 설명 */
  readonly label:  string;
  /**
   * Dash-separated 그룹 크기. 합계가 chars와 일치해야 한다.
   * 예: UUID → [8, 4, 4, 4, 12]
   * undefined/빈 배열이면 dash 없이 연속 hex.
   */
  readonly groups?: readonly number[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  defineFormat — 검증 팩토리
// ═══════════════════════════════════════════════════════════════════════════

export interface DefineFormatOptions {
  name:    string;
  chars:   number;
  label:   string;
  groups?: number[];
}

/**
 * Create a validated PackFormat.
 *
 * @throws {RangeError} chars ≤ 0, 또는 groups 합계 ≠ chars
 *
 * @example
 * defineFormat({ name: "token48", chars: 12, label: "48-bit Token" })
 * defineFormat({ name: "custom", chars: 20, label: "Custom", groups: [4, 4, 4, 4, 4] })
 */
export function defineFormat(opts: DefineFormatOptions): PackFormat {
  if (!opts.name) throw new RangeError("PackFormat: name is required");
  if (opts.chars <= 0) throw new RangeError(`PackFormat "${opts.name}": chars must be > 0`);

  const groups = opts.groups?.length ? Object.freeze([...opts.groups]) : undefined;
  if (groups) {
    const sum = groups.reduce((a, b) => a + b, 0);
    if (sum !== opts.chars) {
      throw new RangeError(
        `PackFormat "${opts.name}": groups sum (${sum}) ≠ chars (${opts.chars})`
      );
    }
    if (groups.some(g => g <= 0)) {
      throw new RangeError(`PackFormat "${opts.name}": each group must be > 0`);
    }
  }

  return Object.freeze({
    name:   opts.name,
    chars:  opts.chars,
    bits:   opts.chars * 4,
    label:  opts.label,
    groups,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Built-in formats
// ═══════════════════════════════════════════════════════════════════════════

export const PACK_FORMATS = {
  int64:    defineFormat({ name: "int64",    chars: 16, label: "64-bit Integer" }),
  objectId: defineFormat({ name: "objectId", chars: 24, label: "96-bit ObjectId" }),
  uuid:     defineFormat({ name: "uuid",     chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }),
  sha1:     defineFormat({ name: "sha1",     chars: 40, label: "160-bit (SHA-1)" }),
  sha256:   defineFormat({ name: "sha256",   chars: 64, label: "256-bit (SHA-256)" }),
} as const satisfies Record<string, PackFormat>;

export type BuiltinFormatName = keyof typeof PACK_FORMATS;

/** All built-in formats sorted by chars ascending. */
export const PACK_FORMAT_LIST: readonly PackFormat[] = Object.values(PACK_FORMATS);

// ═══════════════════════════════════════════════════════════════════════════
//  FormatRegistry — 수평 확장 가능한 포맷 레지스트리
// ═══════════════════════════════════════════════════════════════════════════

export class FormatRegistry {
  private readonly map = new Map<string, PackFormat>();

  constructor(formats?: Iterable<PackFormat>) {
    if (formats) {
      for (const f of formats) this.map.set(f.name, f);
    }
  }

  /** 포맷 등록. 동일 이름이면 덮어쓴다. */
  register(format: PackFormat): this {
    this.map.set(format.name, format);
    return this;
  }

  /** 이름으로 조회. 없으면 undefined. */
  get(name: string): PackFormat | undefined {
    return this.map.get(name);
  }

  /** 이름으로 조회. 없으면 throw. */
  require(name: string): PackFormat {
    const f = this.map.get(name);
    if (!f) throw new RangeError(`FormatRegistry: unknown format "${name}"`);
    return f;
  }

  /** 등록 여부 확인. */
  has(name: string): boolean {
    return this.map.has(name);
  }

  /** 포맷 제거. built-in도 제거 가능. */
  remove(name: string): boolean {
    return this.map.delete(name);
  }

  /** chars 오름차순으로 정렬된 전체 목록. */
  list(): PackFormat[] {
    return [...this.map.values()].sort((a, b) => a.chars - b.chars);
  }

  /** 등록된 포맷 수. */
  get size(): number {
    return this.map.size;
  }

  /**
   * 유연한 용량 해석.
   *
   *  - `PackFormat` → 그대로 반환
   *  - `string` → 레지스트리에서 이름으로 조회
   *  - `number` → 해당 chars의 익명 포맷 생성
   */
  resolve(ref: PackFormat | string | number): PackFormat {
    if (typeof ref === "object") return ref;
    if (typeof ref === "string") return this.require(ref);
    return defineFormat({ name: `${ref * 4}bit`, chars: ref, label: `${ref * 4}-bit` });
  }
}

/**
 * Create a FormatRegistry pre-loaded with all built-in formats.
 *
 * @example
 * const reg = createFormatRegistry();
 * reg.register(defineFormat({ name: "cuid", chars: 20, label: "CUID" }));
 * const fmt = reg.resolve("cuid");
 */
export function createFormatRegistry(): FormatRegistry {
  return new FormatRegistry(PACK_FORMAT_LIST);
}

// ═══════════════════════════════════════════════════════════════════════════
//  formatHex / parseHex — 포맷별 dash 직렬화
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insert dashes into a raw hex string according to the format's groups.
 *
 * @example
 * formatHex(PACK_FORMATS.uuid, "abcd0100000000000000000000000042")
 * // → "abcd0100-0000-0000-0000-000000000042"
 *
 * formatHex(PACK_FORMATS.int64, "abcdef0123456789")
 * // → "abcdef0123456789"  (no groups → unchanged)
 */
export function formatHex(format: PackFormat, rawHex: string): string {
  if (!format.groups?.length) return rawHex;
  const parts: string[] = [];
  let pos = 0;
  for (const g of format.groups) {
    parts.push(rawHex.slice(pos, pos + g));
    pos += g;
  }
  return parts.join("-");
}

/**
 * Strip dashes and normalize to lowercase raw hex.
 *
 * @example
 * parseHex("ABCD0100-0000-0000-0000-000000000042")
 * // → "abcd0100000000000000000000000042"
 */
export function parseHex(formatted: string): string {
  return formatted.replace(/-/g, "").toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
//  hexBoundary — hex-digit-level value analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface HexBoundary {
  /** 입력값 */
  value:    number;
  /** value를 표현하는 데 필요한 hex 자릿수 (= charsForMax(value - 1), 단 value ≤ 1이면 1) */
  hexChars: number;
  /** 현재 자릿수에서의 최댓값 (16^hexChars - 1). 예: 3자리 → 4095 */
  hexMax:   number;
  /** 현재 자릿수로 수용 가능한 슬롯 수 (= hexMax + 1). 예: 3자리 → 4096 */
  hexCapacity: number;
  /** 활용률: value / hexCapacity */
  utilization: number;
  /** 다음 자릿수 레벨의 최댓값 (16^(hexChars+1) - 1). 예: 3자리 → 65535 */
  nextHexMax: number;
}

/**
 * Analyze a dimension size against hex digit boundaries.
 *
 * @param value - dimension size (number of values, ≥ 1)
 *
 * @example
 * hexBoundary(1000)
 * // → { value: 1000, hexChars: 3, hexMax: 4095, hexCapacity: 4096,
 * //     utilization: 0.244…, nextHexMax: 65535 }
 */
export function hexBoundary(value: number): HexBoundary {
  const v = Math.max(1, Math.floor(value));
  const hexChars    = charsForMax(v - 1);
  const hexMax      = Math.pow(16, hexChars) - 1;
  const hexCapacity = hexMax + 1;
  return {
    value:       v,
    hexChars,
    hexMax,
    hexCapacity,
    utilization: v / hexCapacity,
    nextHexMax:  Math.pow(16, hexChars + 1) - 1,
  };
}

/**
 * Snap a value up to the hex ceiling (= 16^n) of the current digit level.
 *
 * @example
 * hexCeil(1000)  // 4096   (3 hex digits → 16^3)
 * hexCeil(4096)  // 4096   (already on boundary)
 * hexCeil(4097)  // 65536  (needs 4 hex digits → 16^4)
 */
export function hexCeil(value: number): number {
  const v = Math.max(1, Math.floor(value));
  return Math.pow(16, charsForMax(v - 1));
}

/**
 * Snap a value down to the hex floor (= 16^(n-1)) of the previous digit level,
 * or return the value itself if it already sits at a boundary.
 *
 * @example
 * hexFloor(1000)  // 256  (2 hex digits → 16^2)
 * hexFloor(256)   // 256
 * hexFloor(4096)  // 4096
 */
export function hexFloor(value: number): number {
  const v = Math.max(1, Math.floor(value));
  if (v <= 1) return 1;
  const chars = charsForMax(v - 1);
  const ceil  = Math.pow(16, chars);
  if (v === ceil) return v;
  return Math.pow(16, chars - 1);
}

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
    const descFree = [...freeIndices].sort((a, b) => result[b] - result[a]);
    while (product > maxProduct) {
      let reduced = false;
      for (const i of descFree) {
        if (result[i] > minArr[i]) {
          product = product / result[i] * (result[i] - 1);
          result[i]--;
          reduced = true;
          if (product <= maxProduct) break;
        }
      }
      if (!reduced) return null;
    }
  }

  const priority = [...freeIndices].sort((a, b) => shape[b] - shape[a]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of priority) {
      if (result[i] >= shape[i]) continue;
      const next = product / result[i] * (result[i] + 1);
      if (next <= maxProduct) {
        product = next;
        result[i]++;
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
