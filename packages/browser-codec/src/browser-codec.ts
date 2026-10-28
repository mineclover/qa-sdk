/** @def.boundary browser-runtime-system */
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
  readonly kind: 'axis' | 'prefix_ref';
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

export interface BrowserServiceDims {
  readonly env: string;
  readonly region: string;
  readonly svc_name: string;
  readonly namespace: string;
}

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

    if (dim.kind === 'axis') {
      const entries = dim.entries ?? [];
      shape.push(dim.capacity ?? entries.length);
      const idx = entries.indexOf(values[label] as string);
      if (idx < 0) return null;
      positions.push(idx);
    } else {
      const vals = dim.values ?? [];
      if (vals.length === 0) return null;
      shape.push(vals.length);
      const v = values[label];
      if (v === undefined) return null;
      const idx = vals.indexOf(v as number);
      if (idx < 0) return null;
      positions.push(idx);
    }
  }

  // canonical: weighted-index/calc.ts → calcWeights (브라우저 번들 격리 위해 인라인)
  const strides = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * shape[i + 1];

  let addr = 0;
  for (let i = 0; i < positions.length; i++) addr += positions[i] * strides[i];

  return {
    prefix: prefixId,
    version: def.version,
    address: addr,
    serialized: `${prefixId}:${def.version}:${addr}`,
  };
}

/**
 * serialized 주소 → 차원 값.
 */
export function decode(
  catalog: BrowserCatalog,
  serialized: string,
): { prefix: string; version: string; values: Record<string, string | number> } | null {
  // canonical: @qa-sdk/core/lib/address-parser.ts (브라우저 번들 격리 위해 인라인)
  const parts = serialized.split(':');
  // 3파트: prefix:ver:addr / 4파트: catalogId:prefix:ver:addr
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [prefixId, version, addrStr] =
    parts.length === 4 ? [parts[1], parts[2], parts[3]] : [parts[0], parts[1], parts[2]];
  const def = catalog[prefixId];
  if (!def) return null;
  if (version !== def.version) return null;

  if (!/^\d+$/.test(addrStr)) return null;
  let addr = Number(addrStr);
  if (!Number.isInteger(addr) || addr < 0) return null;

  const shape: number[] = [];
  const labels: { label: string; dim: BrowserDimDef }[] = [];

  for (const label of def.labels) {
    const dim = def.dims[label];
    if (!dim) continue;
    if (dim.kind === 'axis') {
      const entries = dim.entries ?? [];
      shape.push(dim.capacity ?? entries.length);
    } else {
      shape.push((dim.values ?? []).length);
    }
    labels.push({ label, dim });
  }
  const capacity = shape.reduce((acc, cur) => acc * cur, 1);
  if (capacity <= 0 || addr >= capacity) return null;

  // canonical: weighted-index/calc.ts → calcWeights (브라우저 번들 격리 위해 인라인)
  const strides = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * shape[i + 1];

  const values: Record<string, string | number> = {};
  for (let i = 0; i < labels.length; i++) {
    const pos = Math.floor(addr / strides[i]);
    addr %= strides[i];
    const { label, dim } = labels[i];
    // headroom 표기 canonical: @qa-sdk/core reservedEntryLabel (브라우저 번들 격리 위해 인라인)
    values[label] =
      dim.kind === 'axis'
        ? ((dim.entries ?? [])[pos] ?? `(reserved:${pos})`)
        : ((dim.values ?? [])[pos] ?? pos);
  }

  return { prefix: prefixId, version, values };
}

/**
 * 여러 prefix를 한번에 encode.
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
    for (const label of def.labels) {
      const dim = def.dims[label];
      const firstRef = dim?.kind === 'prefix_ref' ? dim.values?.[0] : undefined;
      if (fullDims[label] === undefined && firstRef !== undefined) {
        fullDims[label] = firstRef;
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

/**
 * service prefix에 필요한 axis entry가 없으면 로컬 browser catalog에만 덧입힌다.
 *
 * 목적:
 * - 새 소비처가 canonical catalog를 아직 갱신하지 않았더라도
 *   브라우저 로컬에서 service prefix proof를 수행할 수 있게 한다.
 *
 * 제약:
 * - service prefix만 확장한다.
 * - axis capacity를 넘기면 throw한다.
 */
export function withServiceOverlay(
  catalog: BrowserCatalog,
  serviceDims: BrowserServiceDims,
): BrowserCatalog {
  const service = catalog['service'];
  if (!service) {
    throw new Error('service prefix is missing in browser catalog');
  }

  let changed = false;
  const nextDims: Record<string, BrowserDimDef> = { ...service.dims };

  for (const label of service.labels) {
    const dim = service.dims[label];
    if (!dim) continue;
    if (dim.kind !== 'axis') {
      throw new Error(`service.${label} must be an axis dim`);
    }

    const value = serviceDims[label as keyof BrowserServiceDims];
    if (typeof value !== 'string') continue;

    const entries = [...(dim.entries ?? [])];
    if (entries.includes(value)) continue;

    const capacity = dim.capacity ?? entries.length;
    if (entries.length >= capacity) {
      throw new Error(`service.${label} capacity exceeded: ${entries.length}/${capacity}`);
    }

    entries.push(value);
    nextDims[label] = {
      ...dim,
      entries,
    };
    changed = true;
  }

  if (!changed) {
    return catalog;
  }

  return {
    ...catalog,
    service: {
      ...service,
      dims: nextDims,
    },
  };
}

// ═══════════════════════════════════════════════════
//  Signal 런타임 분류 (인라인 — zero-dependency 유지)
// ═══════════════════════════════════════════════════

export type SignalRole =
  | 'context' // 어디서 — service, page_view (환경/위치)
  | 'trigger' // 뭘 했는가 — tracking, *_event (유저 행동/시스템 이벤트)
  | 'channel' // 어떤 경로로 — endpoint (API/webhook/gRPC)
  | 'state' // 흐름 어디 — flow_point (비즈니스 흐름 위치)
  | 'guard' // 어떤 조건 — permission, rbac (권한/정책)
  | 'effect' // 결과 — pipeline_point, health_event, deploy_event
  | 'data'; // 데이터 접점 — table refs (DB 읽기/쓰기)

const PREFIX_ROLE_MAP: Record<string, SignalRole> = {
  // context
  service: 'context',
  page_view: 'context',
  // trigger
  tracking: 'trigger',
  cart_event: 'trigger',
  auth_event: 'trigger',
  order_event: 'trigger',
  event: 'trigger',
  engine_event: 'trigger',
  schema_event: 'trigger',
  // channel
  endpoint: 'channel',
  // state
  flow_point: 'state',
  // guard
  permission: 'guard',
  rbac: 'guard',
  // effect
  pipeline_point: 'effect',
  health_event: 'effect',
  deploy_event: 'effect',
  data_policy: 'effect',
  // data
  members: 'data',
  orders: 'data',
  items: 'data',
  orgs: 'data',
  carts: 'data',
  cart_items: 'data',
  // relation
  relational: 'context',
  content: 'context',
};

function getPrefixRole(prefixId: string): SignalRole {
  return PREFIX_ROLE_MAP[prefixId] ?? 'trigger';
}

function classifyByRole(
  addressContext: Record<string, string>,
): Record<SignalRole, { prefixId: string; serialized: string }[]> {
  const result: Record<SignalRole, { prefixId: string; serialized: string }[]> = {
    context: [],
    trigger: [],
    channel: [],
    state: [],
    guard: [],
    effect: [],
    data: [],
  };
  for (const [prefixId, serialized] of Object.entries(addressContext)) {
    const role = getPrefixRole(prefixId);
    result[role].push({ prefixId, serialized });
  }
  return result;
}

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
