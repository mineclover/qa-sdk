/**
 * BrowserCodec — 브라우저에서 사용 가능한 경량 encode/decode.
 *
 * DEMO_CATALOG의 축/prefix 정의를 JSON으로 받아
 * mixed-radix encode/decode를 수행한다.
 *
 * 이 모듈이 단일 출처가 되면:
 *   shop-web/index.html — 인라인 encode 제거 → import { encode } from viz-3d-core
 *   monitor.html — 인라인 encode 제거 → 동일
 *   sdk/qa-context — 이미 demo-snapshot 의존 (호환)
 */

// ═══════════════════════════════════════════════════
//  Catalog Schema (경량)
// ═══════════════════════════════════════════════════

export interface BrowserDimDef {
  readonly kind: "axis" | "prefix_ref";
  /** axis일 때 */
  readonly entries?: readonly string[];
  readonly capacity?: number;
  /** prefix_ref일 때 */
  readonly values?: readonly number[];
}

export interface BrowserPrefixDef {
  readonly version: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, BrowserDimDef>;
}

export type BrowserCatalog = Record<string, BrowserPrefixDef>;

// ═══════════════════════════════════════════════════
//  Encode / Decode
// ═══════════════════════════════════════════════════

export interface EncodeResult {
  readonly prefix: string;
  readonly version: string;
  readonly address: number;
  readonly serialized: string;
}

/**
 * 차원 값 → serialized 주소.
 */
export function encode(
  catalog: BrowserCatalog,
  prefixId: string,
  values: Record<string, string | number>,
): EncodeResult | null {
  const def = catalog[prefixId];
  if (!def) return null;

  const shape: number[] = [];
  const positions: number[] = [];

  for (const label of def.labels) {
    const dim = def.dims[label];
    if (!dim) return null;

    if (dim.kind === "axis") {
      shape.push(dim.capacity ?? dim.entries!.length);
      const idx = dim.entries!.indexOf(values[label] as string);
      if (idx < 0) return null;
      positions.push(idx);
    } else {
      const vals = dim.values!;
      shape.push(vals.length);
      const v = values[label] ?? vals[0];
      const idx = vals.indexOf(v as number);
      positions.push(idx < 0 ? 0 : idx);
    }
  }

  const strides = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * shape[i + 1];

  let addr = 0;
  for (let i = 0; i < positions.length; i++) addr += positions[i] * strides[i];

  return { prefix: prefixId, version: def.version, address: addr, serialized: `${prefixId}:${def.version}:${addr}` };
}

/**
 * serialized 주소 → 차원 값.
 */
export function decode(
  catalog: BrowserCatalog,
  serialized: string,
): { prefix: string; version: string; values: Record<string, string | number> } | null {
  const [prefixId, version, addrStr] = serialized.split(":");
  const def = catalog[prefixId];
  if (!def) return null;

  let addr = parseInt(addrStr);
  if (isNaN(addr)) return null;

  const shape: number[] = [];
  const labels: { label: string; dim: BrowserDimDef }[] = [];

  for (const label of def.labels) {
    const dim = def.dims[label];
    if (!dim) continue;
    if (dim.kind === "axis") {
      shape.push(dim.capacity ?? dim.entries!.length);
    } else {
      shape.push(dim.values!.length);
    }
    labels.push({ label, dim });
  }

  const strides = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * shape[i + 1];

  const values: Record<string, string | number> = {};
  for (let i = 0; i < labels.length; i++) {
    const pos = Math.floor(addr / strides[i]);
    addr %= strides[i];
    const { label, dim } = labels[i];
    values[label] = dim.kind === "axis"
      ? (dim.entries![pos] ?? `(${pos})`)
      : (dim.values![pos] ?? pos);
  }

  return { prefix: prefixId, version, values };
}

/**
 * 여러 prefix를 한번에 encode + service 자동 주입.
 */
export function track(
  catalog: BrowserCatalog,
  prefixDims: Record<string, Record<string, string | number>>,
): Record<string, string> {
  const ctx: Record<string, string> = {};

  for (const [prefixId, dims] of Object.entries(prefixDims)) {
    const def = catalog[prefixId];
    if (!def) continue;

    const fullDims = { ...dims };
    // prefix_ref 자동 주입
    for (const label of def.labels) {
      const dim = def.dims[label];
      if (dim?.kind === "prefix_ref" && !(label in fullDims)) {
        fullDims[label] = dim.values![0];
      }
    }

    const result = encode(catalog, prefixId, fullDims);
    if (result) ctx[prefixId] = result.serialized;
  }

  return ctx;
}

/**
 * address_context의 모든 prefix를 decode.
 */
export function decodeContext(
  catalog: BrowserCatalog,
  addressContext: Record<string, string>,
): Record<string, { prefix: string; values: Record<string, string | number> }> {
  const result: Record<string, { prefix: string; values: Record<string, string | number> }> = {};

  for (const [prefixId, serialized] of Object.entries(addressContext)) {
    const decoded = decode(catalog, serialized);
    if (decoded) result[prefixId] = { prefix: decoded.prefix, values: decoded.values };
  }

  return result;
}

// ═══════════════════════════════════════════════════
//  Signal 런타임 분류
// ═══════════════════════════════════════════════════

import { classifyByRole, type SignalRole } from "../core/signal-model.js";

/**
 * address_context를 encode + Signal role 분류까지 한 번에 수행.
 */
export function trackWithSignal(
  catalog: BrowserCatalog,
  prefixDims: Record<string, Record<string, string | number>>,
): {
  addressContext: Record<string, string>;
  byRole: Record<SignalRole, { prefixId: string; serialized: string }[]>;
} {
  const addressContext = track(catalog, prefixDims);
  const byRole = classifyByRole(addressContext);
  return { addressContext, byRole };
}
