/**
 * runtime.ts — 범용 Catalog 접근 API.
 *
 * 구조(structure), 형상(shape), 엔트리(entries)를 계층별로 조회.
 * encode/decode/resolve로 차원 합성·분해·의미 해석을 지원.
 *
 * 핵심 원리: 모든 차원(axis·prefix_ref)은 고유 의미값을 갖고,
 * 차원 분해·합성 시 mixed-radix 구조에 의해 정합성이 보장된다.
 */

import type { Catalog, DimRef, PrefixDef } from "./catalog.types.js";

// ── 반환 타입 ────────────────────────────────────────────────────────────────

export interface PrefixStructure {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: PrefixDef["dims"];
  readonly versions: readonly string[];
}

export interface PrefixShape {
  readonly shape: readonly number[];
  readonly capacity: number;
  readonly dimCapacities: Record<string, number>;
}

export interface PrefixEntries {
  readonly entries: Record<string, readonly (string | number)[]>;
  readonly ko: Record<string, Record<string, string>>;
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * mixed-radix strides 계산 (weighted-index의 calcWeights 인라인).
 *
 * W[i] = product of shape[j] for j > i  (= 1 for last dimension)
 */
function calcWeights(shape: readonly number[]): number[] {
  const d = shape.length;
  if (d === 0) return [];
  const weights = new Array<number>(d);
  weights[d - 1] = 1;
  for (let i = d - 2; i >= 0; i--) {
    weights[i] = weights[i + 1] * shape[i + 1];
  }
  return weights;
}

function resolveAxisCap(catalog: Catalog, axisId: string, version: string): number {
  const axis = catalog.axes[axisId];
  if (!axis) throw new Error(`Unknown axis: ${axisId}`);
  const snap = axis.versions[version];
  if (!snap) throw new Error(`Unknown axis version: ${axisId}@${version}`);
  return snap.capacity ?? snap.entries.length;
}

/** table_ref가 아닌 차원(고정 차원)의 labels만 반환 */
function getFixedLabels(prefix: { labels: readonly string[]; dims: Record<string, DimRef> }): string[] {
  return prefix.labels.filter(l => prefix.dims[l].kind !== "table_ref");
}

function resolvePrefixCapacity(catalog: Catalog, prefixId: string, version: string): number {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  let capacity = 1;
  for (const label of getFixedLabels(prefix)) {
    const dim = prefix.dims[label];
    if (dim.kind === "axis") {
      capacity *= resolveAxisCap(catalog, dim.axisId, vdef.axisVersions[label]);
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      capacity *= ref
        ? ref.values.length
        : resolvePrefixCapacity(catalog, dim.prefixId, vdef.axisVersions[label] ?? "v1");
    }
  }
  return capacity;
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/** prefix의 최신 버전 키를 동적으로 조회. 하드코딩 금지 — 이 함수가 SSOT. */
export function latestPrefixVersion(catalog: Catalog, prefixId: string): string {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix?.versions?.length) return "v1";
  return prefix.versions[prefix.versions.length - 1].version;
}

/** 구조만 — labels + dim refs + version 목록 */
export function getPrefixStructure(catalog: Catalog, prefixId: string): PrefixStructure {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  return {
    id: prefix.id,
    name: prefix.name,
    description: prefix.description,
    labels: prefix.labels,
    dims: prefix.dims,
    versions: prefix.versions.map(v => v.version),
  };
}

/** capacity/shape만 — table_ref 차원은 제외. 고정 차원만 shape에 포함. */
export function getPrefixShape(catalog: Catalog, prefixId: string, version: string): PrefixShape {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  const shape: number[] = [];
  const dimCapacities: Record<string, number> = {};

  for (const label of getFixedLabels(prefix)) {
    const dim = prefix.dims[label];
    let cap: number;
    if (dim.kind === "axis") {
      cap = resolveAxisCap(catalog, dim.axisId, vdef.axisVersions[label]);
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      cap = ref
        ? ref.values.length
        : resolvePrefixCapacity(catalog, dim.prefixId, vdef.axisVersions[label] ?? "v1");
    } else {
      continue; // table_ref: skip
    }
    shape.push(cap);
    dimCapacities[label] = cap;
  }

  return {
    shape,
    capacity: shape.reduce((a, b) => a * b, 1),
    dimCapacities,
  };
}

/** entries 포함 전체 — version별 entries + ko. table_ref 차원은 테이블명만 반환. */
export function getPrefixEntries(catalog: Catalog, prefixId: string, version: string): PrefixEntries {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  const entries: Record<string, readonly (string | number)[]> = {};
  const ko: Record<string, Record<string, string>> = {};

  for (const label of prefix.labels) {
    const dim = prefix.dims[label];
    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      const snap = axis.versions[vdef.axisVersions[label]];
      entries[label] = snap.entries;
      if (snap.ko) ko[label] = snap.ko;
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      if (ref) entries[label] = ref.values;
    }
    // table_ref: entries에 포함하지 않음 (동적 데이터)
  }

  return { entries, ko };
}

// ══════════════════════════════════════════════════════════════════════════════
//  차원 합성·분해·의미 해석 (encode / decode / resolve)
// ══════════════════════════════════════════════════════════════════════════════

// ── 내부: shape → strides ────────────────────────────────────────────────────

function getShapeAndStrides(catalog: Catalog, prefixId: string, version: string) {
  const { shape } = getPrefixShape(catalog, prefixId, version);
  return { shape, strides: calcWeights(shape) };
}

// ── encode: 차원 좌표 → 1D 주소 ─────────────────────────────────────────────

/**
 * 차원별 0-based position → prefix 1D 주소.
 *
 * @param positions  label → 0-based position (예: { perm_svc: 0, role: 3 })
 * @returns 1D 주소 (예: 3)
 */
export function encodePrefix(
  catalog: Catalog, prefixId: string, version: string,
  positions: Record<string, number>,
): number {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const fixedLabels = getFixedLabels(prefix);
  const { strides } = getShapeAndStrides(catalog, prefixId, version);

  let addr = 0;
  for (let i = 0; i < fixedLabels.length; i++) {
    const label = fixedLabels[i];
    const pos = positions[label];
    if (pos === undefined) throw new Error(`Missing position for dim: ${label}`);
    addr += pos * strides[i];
  }
  return addr;
}

// ── decode: 1D 주소 → 차원 좌표 ─────────────────────────────────────────────

export interface DecodedPosition {
  /** 0-based position within this dim's entries/capacity */
  readonly position: number;
  /** axis: entry string, prefix_ref: integer address in referenced prefix */
  readonly value: string | number;
}

/**
 * prefix 1D 주소 → 차원별 position + value.
 *
 * axis 차원: value = entries[position] (headroom이면 `"(reserved:{pos}"`)
 * prefix_ref 차원: value = refEntries.values[position] (참조된 prefix의 1D 주소)
 */
export function decodePrefix(
  catalog: Catalog, prefixId: string, version: string,
  address: number,
): Record<string, DecodedPosition> {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);
  const fixedLabels = getFixedLabels(prefix);
  const { strides } = getShapeAndStrides(catalog, prefixId, version);

  const result: Record<string, DecodedPosition> = {};
  let rest = address;

  for (let i = 0; i < fixedLabels.length; i++) {
    const label = fixedLabels[i];
    const pos = Math.floor(rest / strides[i]);
    rest %= strides[i];

    const dim = prefix.dims[label];
    let value: string | number;
    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      const snap = axis.versions[vdef.axisVersions[label]];
      value = pos < snap.entries.length ? snap.entries[pos] : `(reserved:${pos})`;
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      value = ref ? ref.values[pos] : pos;
    } else {
      continue; // table_ref: not encoded
    }
    result[label] = { position: pos, value };
  }
  return result;
}

// ── resolve: 재귀적 의미 해석 ────────────────────────────────────────────────

export interface ResolvedDimValue {
  /** dim label */
  readonly label: string;
  /** 0-based position */
  readonly position: number;
  /** axis: entry string, prefix_ref: integer address */
  readonly value: string | number;
  /** 한국어 라벨 (있을 경우) */
  readonly ko?: string;
  /** prefix_ref인 경우, 참조된 prefix를 재귀 resolve한 결과 */
  readonly ref?: ResolvedAddress;
}

export interface ResolvedAddress {
  readonly prefix: string;
  readonly version: string;
  readonly address: number;
  readonly dims: Record<string, ResolvedDimValue>;
}

/**
 * prefix 1D 주소를 완전 해석한다.
 *
 * - axis 차원: entry string + ko
 * - prefix_ref 차원: 참조된 prefix를 **재귀** resolve → 트리 형태
 *
 * @example
 * ```ts
 * const r = resolveAddress(catalog, "permission", "v1", 3);
 * r.dims.perm_svc.ref!.dims.env.value  // "prod"
 * r.dims.role.value                      // "viewer"
 * r.dims.role.ko                         // "뷰어"
 * ```
 */
export function resolveAddress(
  catalog: Catalog, prefixId: string, version: string,
  address: number,
): ResolvedAddress {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  const decoded = decodePrefix(catalog, prefixId, version, address);
  const dims: Record<string, ResolvedDimValue> = {};

  for (const label of getFixedLabels(prefix)) {
    const { position, value } = decoded[label];
    const dim = prefix.dims[label];

    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      const snap = axis.versions[vdef.axisVersions[label]];
      const ko = snap.ko && typeof value === "string" ? snap.ko[value] : undefined;
      dims[label] = { label, position, value, ko };
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      const refAddr = ref ? ref.values[position] : position;
      const refVersion = ref?.refVersion ?? "v1";
      const resolved = resolveAddress(catalog, dim.prefixId, refVersion, refAddr as number);
      dims[label] = { label, position, value: refAddr, ref: resolved };
    }
  }

  return { prefix: prefixId, version, address, dims };
}

// ── encode by value: 의미값으로 인코딩 ───────────────────────────────────────

/**
 * 차원별 **의미값** → prefix 1D 주소.
 *
 * axis 차원: entry string (예: "admin") → position lookup
 * prefix_ref 차원: 참조 prefix의 1D 주소 (예: 40) → refEntries position lookup
 *
 * @example
 * ```ts
 * encodePrefixByValue(catalog, "permission", "v1", { perm_svc: 40, role: "admin" })
 * // → 0
 * ```
 */
export function encodePrefixByValue(
  catalog: Catalog, prefixId: string, version: string,
  values: Record<string, string | number>,
): number {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  const positions: Record<string, number> = {};
  for (const label of getFixedLabels(prefix)) {
    const val = values[label];
    if (val === undefined) throw new Error(`Missing value for dim: ${label}`);
    const dim = prefix.dims[label];

    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      const snap = axis.versions[vdef.axisVersions[label]];
      const idx = snap.entries.indexOf(val as string);
      if (idx < 0) throw new Error(`Unknown entry "${val}" for axis ${dim.axisId}@${vdef.axisVersions[label]}`);
      positions[label] = idx;
    } else if (dim.kind === "prefix_ref") {
      const ref = vdef.refEntries?.[label];
      if (!ref) throw new Error(`No refEntries for prefix_ref dim: ${label}`);
      const idx = ref.values.indexOf(val as number);
      if (idx < 0) throw new Error(`Unknown ref value ${val} for dim ${label}`);
      positions[label] = idx;
    }
  }
  return encodePrefix(catalog, prefixId, version, positions);
}

// ── compose / decompose: 하위 prefix 합성·분해 ──────────────────────────────

/**
 * prefix 주소를 차원별로 분해하여 하위 prefix 주소를 추출한다.
 *
 * prefix_ref 차원의 value는 참조된 prefix의 1D 주소이므로,
 * 해당 주소를 다시 decode하면 참조 prefix의 차원 좌표를 얻는다.
 *
 * @returns 차원별 { position, value } + prefix_ref는 refAddress 포함
 */
export interface DecomposedDim {
  readonly position: number;
  readonly value: string | number;
  /** prefix_ref인 경우: 참조된 prefix의 1D 주소 */
  readonly refAddress?: number;
  /** prefix_ref인 경우: 참조된 prefix에서의 decode 결과 */
  readonly refDims?: Record<string, DecodedPosition>;
}

export function decomposeAddress(
  catalog: Catalog, prefixId: string, version: string,
  address: number,
): Record<string, DecomposedDim> {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${version}`);

  const decoded = decodePrefix(catalog, prefixId, version, address);
  const result: Record<string, DecomposedDim> = {};

  for (const label of getFixedLabels(prefix)) {
    const { position, value } = decoded[label];
    const dim = prefix.dims[label];

    if (dim.kind === "axis") {
      result[label] = { position, value };
    } else if (dim.kind === "prefix_ref") {
      const refAddr = value as number;
      const refVersion = vdef.refEntries?.[label]?.refVersion ?? "v1";
      const refDims = decodePrefix(catalog, dim.prefixId, refVersion, refAddr);
      result[label] = { position, value: refAddr, refAddress: refAddr, refDims };
    }
  }
  return result;
}

// ── 라운드트립 검증 헬퍼 ─────────────────────────────────────────────────────

/**
 * encode → decode 라운드트립이 정합한지 검증한다.
 * 모든 유효 주소에 대해 encode(decode(addr)) === addr 보장.
 */
export function verifyRoundTrip(
  catalog: Catalog, prefixId: string, version: string,
): { valid: boolean; capacity: number; errors: string[] } {
  const { capacity } = getPrefixShape(catalog, prefixId, version);
  const errors: string[] = [];

  for (let addr = 0; addr < capacity; addr++) {
    const decoded = decodePrefix(catalog, prefixId, version, addr);
    const positions: Record<string, number> = {};
    for (const [label, d] of Object.entries(decoded)) positions[label] = d.position;
    const reencoded = encodePrefix(catalog, prefixId, version, positions);
    if (reencoded !== addr) {
      errors.push(`addr ${addr}: re-encoded to ${reencoded}`);
      if (errors.length >= 10) break;
    }
  }
  return { valid: errors.length === 0, capacity, errors };
}
