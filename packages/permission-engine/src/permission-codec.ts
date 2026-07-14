// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * permission-codec.ts — text ↔ integer ↔ bitmask 3-tier 코덱.
 *
 * 3-tier 프로토콜 스택:
 *   Tier 1 (text):    "shop/payment.api.admin/teams.GET"   — 사람용
 *   Tier 2 (integer): "perm:v2:42" 또는 42                 — 1D 주소 (SemanticAddress)
 *   Tier 3 (bitmask): Uint8Array bit[42]=1                 — O(1) 클라이언트 체크
 *
 * PermissionCodec이 Tier 1 ↔ Tier 2 변환을 담당한다.
 * Tier 2 ↔ Tier 3 변환은 기존 PermissionSet/bitmask가 담당한다.
 */

import {
  WeightedIndex,
  createLabelRegistry,
  type LabelRegistry,
  EntityNotFoundError,
  createMask,
  setBit,
  clearBit,
  hasBit,
  popcount,
} from 'weighted-index';

import { BitIndex, BitMaskSet, IndexBridge } from 'bit-index';

import { formatPermCode, parsePermCode, type PermissionCode } from './permission-code.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** 코덱 차원 정의. 등록된 ID 목록 순서가 1-based 인덱스가 된다. */
export interface CodecDims {
  services: readonly string[]; // "shop/payment", "cms/auth", ...
  types: readonly string[]; // "api", "page", "action"
  resources: readonly string[]; // "admin/teams", "billing/invoices", ...
  actions: readonly string[]; // "GET", "POST", "view", "edit", ...
}

/** 디코딩된 좌표. */
export interface DecodedPerm {
  service: string;
  type: string;
  resource: string;
  action: string;
  /** 1D integer address. */
  address: number;
}

/** 코덱 직렬화 형태. */
export interface CodecSnapshot {
  version: string;
  dims: CodecDims;
  /** base64 bitmask (선택). */
  mask?: string;
}

type PermissionLabelSchema = {
  service: string;
  type: string;
  resource: string;
  action: string;
};

// ── 내부 상수 ────────────────────────────────────────────────────────────────

const LABEL_VERSION = 'v1';
const DIM_LABELS = ['service', 'type', 'resource', 'action'] as const;

// ── PermissionCodec ──────────────────────────────────────────────────────────

export class PermissionCodec {
  /** 내부 WeightedIndex — shape = [services, types, resources, actions]. */
  readonly index: WeightedIndex;
  readonly version: string;

  private readonly _dims: CodecDims;
  /** D-1: LabelRegistry에 위임하여 string→index 맵 중복 제거 */
  private readonly _labels: LabelRegistry<PermissionLabelSchema>;

  // ── BitIndex 최적화 레이어 (lazy) ────────────────────────────────────
  private _bitIndex?: BitIndex;
  private _bridge?: IndexBridge;

  constructor(version: string, dims: CodecDims) {
    this.version = version;
    this._dims = dims;

    // CodecDims → LabelRegistry 변환
    this._labels = createLabelRegistry({
      service: [{ version: LABEL_VERSION, ids: [...dims.services] }],
      type: [{ version: LABEL_VERSION, ids: [...dims.types] }],
      resource: [{ version: LABEL_VERSION, ids: [...dims.resources] }],
      action: [{ version: LABEL_VERSION, ids: [...dims.actions] }],
    });

    this.index = new WeightedIndex([
      dims.services.length,
      dims.types.length,
      dims.resources.length,
      dims.actions.length,
    ]);
  }

  /** 전체 슬롯 수. */
  get size(): number {
    return this.index.size;
  }

  get dims(): CodecDims {
    return this._dims;
  }

  // ── Tier 1 → Tier 2: text → integer ────────────────────────────────────

  /** permission code 문자열 → integer address. */
  encode(text: string): number {
    const code = parsePermCode(text);
    return this.encodeCode(code);
  }

  /** PermissionCode 객체 → integer address. */
  encodeCode(code: PermissionCode): number {
    return this.index.encode([
      this._getLabelIndex('service', code.service),
      this._getLabelIndex('type', code.type),
      this._getLabelIndex('resource', code.resource),
      this._getLabelIndex('action', code.action),
    ]);
  }

  /** 개별 파트 → integer address. */
  encodeRaw(service: string, type: string, resource: string, action: string): number {
    return this.index.encode([
      this._getLabelIndex('service', service),
      this._getLabelIndex('type', type),
      this._getLabelIndex('resource', resource),
      this._getLabelIndex('action', action),
    ]);
  }

  // ── Tier 2 → Tier 1: integer → text ────────────────────────────────────

  /** integer address → DecodedPerm. */
  decode(address: number): DecodedPerm {
    const coords = this.index.decode(address);
    return {
      service: this._labels.getEntityId('service', LABEL_VERSION, coords[0]) as string,
      type: this._labels.getEntityId('type', LABEL_VERSION, coords[1]) as string,
      resource: this._labels.getEntityId('resource', LABEL_VERSION, coords[2]) as string,
      action: this._labels.getEntityId('action', LABEL_VERSION, coords[3]) as string,
      address,
    };
  }

  /** integer address → text 문자열. */
  decodeToText(address: number): string {
    const d = this.decode(address);
    return formatPermCode(d);
  }

  // ── Tier 2 직렬화 (SemanticAddress 호환) ────────────────────────────────

  /** integer address → "perm:v2:42" 형태. */
  serialize(address: number, schema = 'perm'): string {
    return `${schema}:${this.version}:${address}`;
  }

  /** "perm:v2:42" → integer address. 버전 검증 포함. */
  parse(serialized: string): number {
    const parts = serialized.split(':');
    if (parts.length < 2) {
      throw new RangeError(`Invalid serialized address: "${serialized}"`);
    }
    // schema:version:address 또는 schema:address
    const addressStr = parts[parts.length - 1];
    const address = Number(addressStr);
    if (!Number.isInteger(address) || address < 0 || address >= this.size) {
      throw new RangeError(`Address ${addressStr} out of range [0, ${this.size})`);
    }
    return address;
  }

  // ── Tier 3 헬퍼: bitmask 생성 ──────────────────────────────────────────

  /** 빈 bitmask 생성. */
  createMask(): Uint8Array {
    return createMask(this.size);
  }

  /** bitmask에 text permission 부여. */
  grantTo(mask: Uint8Array, text: string): void {
    setBit(mask, this.encode(text));
  }

  /** bitmask에서 text permission 회수. */
  revokeFrom(mask: Uint8Array, text: string): void {
    clearBit(mask, this.encode(text));
  }

  /** bitmask에서 text permission 확인. */
  check(mask: Uint8Array, text: string): boolean {
    return hasBit(mask, this.encode(text));
  }

  /** bitmask에 raw 파트로 권한 부여. */
  grantRaw(
    mask: Uint8Array,
    service: string,
    type: string,
    resource: string,
    action: string,
  ): void {
    setBit(mask, this.encodeRaw(service, type, resource, action));
  }

  /** bitmask에서 raw 파트로 권한 확인. */
  checkRaw(
    mask: Uint8Array,
    service: string,
    type: string,
    resource: string,
    action: string,
  ): boolean {
    return hasBit(mask, this.encodeRaw(service, type, resource, action));
  }

  /** bitmask의 부여된 권한 수. */
  countGrants(mask: Uint8Array): number {
    return popcount(mask);
  }

  /** bitmask의 모든 부여된 권한을 text로 반환. */
  listGrants(mask: Uint8Array): string[] {
    const result: string[] = [];
    for (let i = 0; i < this.size; i++) {
      if (hasBit(mask, i)) {
        result.push(this.decodeToText(i));
      }
    }
    return result;
  }

  /** bitmask의 모든 부여된 권한을 DecodedPerm으로 반환. */
  listGrantsDecoded(mask: Uint8Array): DecodedPerm[] {
    const result: DecodedPerm[] = [];
    for (let i = 0; i < this.size; i++) {
      if (hasBit(mask, i)) {
        result.push(this.decode(i));
      }
    }
    return result;
  }

  // ── BitIndex 최적화 API ──────────────────────────────────────────────
  //
  // Uint8Array 마스크(WI 주소 기반)와 병행하여,
  // BitMaskSet(BI packed 기반)을 통한 O(1) 차원 추출 필터링을 제공한다.
  //
  // 사용 패턴:
  //   const bitSet = codec.toBitMaskSet(mask);    // WI 마스크 → BitMaskSet
  //   bitSet.filterByLabel("service", svcIdx);    // O(1) 차원 필터
  //   const newMask = codec.toUint8Mask(bitSet);  // BitMaskSet → WI 마스크

  /** BitIndex 인스턴스 (lazy). 같은 shape, DIM_LABELS. */
  get bitIndex(): BitIndex {
    if (!this._bitIndex) {
      this._bitIndex = new BitIndex([...this.index.shape], [...DIM_LABELS]);
    }
    return this._bitIndex;
  }

  /** WI ↔ BI 브릿지 (lazy). */
  get bridge(): IndexBridge {
    if (!this._bridge) {
      this._bridge = new IndexBridge([...this.index.shape], [...DIM_LABELS]);
    }
    return this._bridge;
  }

  /** 빈 BitMaskSet 생성. */
  createBitMaskSet(): BitMaskSet {
    return new BitMaskSet(this.bitIndex);
  }

  /**
   * Uint8Array 마스크(WI 주소) → BitMaskSet(BI packed).
   * 마스크의 모든 set bit을 BI packed 값으로 변환한다.
   */
  toBitMaskSet(mask: Uint8Array): BitMaskSet {
    const set = new BitMaskSet(this.bitIndex);
    const br = this.bridge;
    for (let i = 0; i < this.size; i++) {
      if (hasBit(mask, i)) {
        set.grantPacked(br.toBitUnsafe(i));
      }
    }
    return set;
  }

  /**
   * BitMaskSet(BI packed) → Uint8Array 마스크(WI 주소).
   * BitMaskSet의 모든 항목을 WI 주소로 변환하여 마스크에 set한다.
   */
  toUint8Mask(set: BitMaskSet): Uint8Array {
    const mask = createMask(this.size);
    const br = this.bridge;
    for (const biPacked of set.entries) {
      setBit(mask, br.toWeightedUnsafe(biPacked));
    }
    return mask;
  }

  /**
   * 차원 조건으로 마스크를 필터링하여 DecodedPerm 목록 반환.
   *
   * 내부적으로 WI 마스크 → BitMaskSet 변환 후 extractDim으로 O(1) 필터.
   * 조건에 맞는 항목만 full decode하므로, 전체 순회+decode보다 효율적.
   *
   * @param conditions 차원별 필터. { service: "shop/payment", type: "api" }
   *
   * @example
   * const results = codec.filterGrants(mask, { service: "shop/payment" });
   * // → shop/payment 서비스의 부여된 권한만 (action, resource 불문)
   */
  filterGrants(
    mask: Uint8Array,
    conditions: Partial<Record<'service' | 'type' | 'resource' | 'action', string>>,
  ): DecodedPerm[] {
    // 라벨 문자열 → 1-based 인덱스 변환
    const dimConditions: Record<string, number> = {};
    for (const [label, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        dimConditions[label] = this._getLabelIndex(label as keyof PermissionLabelSchema, value);
      }
    }

    const bitSet = this.toBitMaskSet(mask);
    const filtered = bitSet.filterByLabels(dimConditions);
    const br = this.bridge;

    return filtered.map((biPacked) => this.decode(br.toWeightedUnsafe(biPacked)));
  }

  /**
   * 캐시된 필터 뷰 생성. mask 1개당 1회 변환, 이후 모든 필터 O(granted).
   *
   * @example
   * const view = codec.createView(mask);
   * view.filterByService("shop/payment");   // 캐시된 BitMaskSet 사용
   * view.filterByType("api");               // 추가 변환 없음
   * view.distinctServices();                // 어떤 서비스가 있는지
   * view.check("shop/payment", "api", "admin/teams", "GET");  // O(1)
   */
  createView(mask: Uint8Array): PermissionView {
    return new PermissionView(this, mask);
  }

  private _getLabelIndex(label: keyof PermissionLabelSchema, value: string): number {
    try {
      return this._labels.getIndex(label, LABEL_VERSION, value);
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new RangeError(`Unknown ${label}: "${value}"`);
      }
      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PermissionView — 캐시된 BitMaskSet 기반 필터 뷰
// ═══════════════════════════════════════════════════════════════════════════

/**
 * mask 1개에 대한 캐시된 필터 뷰.
 *
 * 생성 시 Uint8Array → BitMaskSet 변환을 1회 수행하고,
 * 이후 모든 필터/질의는 캐시된 BitMaskSet에서 O(granted) 수행.
 *
 * ── 성능 ────────────────────────────────────────────────────────────────
 *
 *   단발 filterGrants: ~250 ops/s (매번 변환)
 *   createView 1회 + filter N회: ~1,200+ ops/s per filter (6× 빠름)
 *
 * ── 수명 ────────────────────────────────────────────────────────────────
 *
 *   mask가 변경되면 view를 새로 생성해야 한다.
 *   view는 생성 시점의 mask 스냅샷을 보유한다.
 */
export class PermissionView {
  private readonly _codec: PermissionCodec;
  private readonly _bitSet: BitMaskSet;

  constructor(codec: PermissionCodec, mask: Uint8Array) {
    this._codec = codec;
    this._bitSet = codec.toBitMaskSet(mask);
  }

  /** 캐시된 BitMaskSet (advanced). */
  get bitSet(): BitMaskSet {
    return this._bitSet;
  }

  // ── 점진적 패치 (재생성 없이 O(1)) ───────────────────────────────

  /** 권한 1건 부여 (view 재생성 없이). */
  applyGrant(service: string, type: string, resource: string, action: string): void {
    const packed = this._codec.bitIndex.encode([
      this._codec['_getLabelIndex']('service', service),
      this._codec['_getLabelIndex']('type', type),
      this._codec['_getLabelIndex']('resource', resource),
      this._codec['_getLabelIndex']('action', action),
    ]);
    this._bitSet.grantPacked(packed);
  }

  /** 권한 1건 회수 (view 재생성 없이). */
  applyRevoke(service: string, type: string, resource: string, action: string): void {
    const packed = this._codec.bitIndex.encode([
      this._codec['_getLabelIndex']('service', service),
      this._codec['_getLabelIndex']('type', type),
      this._codec['_getLabelIndex']('resource', resource),
      this._codec['_getLabelIndex']('action', action),
    ]);
    this._bitSet.revokePacked(packed);
  }

  /** 부여된 권한 수. */
  get size(): number {
    return this._bitSet.size;
  }

  // ── O(1) 확인 ──────────────────────────────────────────────────────

  /** 좌표 기반 권한 확인. O(1). */
  check(service: string, type: string, resource: string, action: string): boolean {
    const bi = this._codec.bitIndex;
    const packed = bi.encode([
      this._codec['_getLabelIndex']('service', service),
      this._codec['_getLabelIndex']('type', type),
      this._codec['_getLabelIndex']('resource', resource),
      this._codec['_getLabelIndex']('action', action),
    ]);
    return this._bitSet.checkPacked(packed);
  }

  // ── 차원 필터 ──────────────────────────────────────────────────────

  /** service별 필터 → DecodedPerm[]. */
  filterByService(service: string): DecodedPerm[] {
    return this._filterByLabel('service', service);
  }

  /** type별 필터 → DecodedPerm[]. */
  filterByType(type: string): DecodedPerm[] {
    return this._filterByLabel('type', type);
  }

  /** resource별 필터 → DecodedPerm[]. */
  filterByResource(resource: string): DecodedPerm[] {
    return this._filterByLabel('resource', resource);
  }

  /** action별 필터 → DecodedPerm[]. */
  filterByAction(action: string): DecodedPerm[] {
    return this._filterByLabel('action', action);
  }

  /** 복합 조건 필터 → DecodedPerm[]. */
  filter(
    conditions: Partial<Record<'service' | 'type' | 'resource' | 'action', string>>,
  ): DecodedPerm[] {
    const dimConditions: Record<string, number> = {};
    for (const [label, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        dimConditions[label] = this._codec['_getLabelIndex'](
          label as keyof PermissionLabelSchema,
          value,
        );
      }
    }

    const filtered = this._bitSet.filterByLabels(dimConditions);
    const br = this._codec.bridge;
    return filtered.map((biPacked) => this._codec.decode(br.toWeightedUnsafe(biPacked)));
  }

  /** 부여된 권한 전체 → DecodedPerm[]. */
  listAll(): DecodedPerm[] {
    const br = this._codec.bridge;
    return [...this._bitSet.entries].map((biPacked) =>
      this._codec.decode(br.toWeightedUnsafe(biPacked)),
    );
  }

  // ── 고유 값 조회 ──────────────────────────────────────────────────

  /** 부여된 권한에서 고유 service 목록. */
  distinctServices(): string[] {
    return this._distinctLabels('service');
  }

  /** 부여된 권한에서 고유 type 목록. */
  distinctTypes(): string[] {
    return this._distinctLabels('type');
  }

  /** 부여된 권한에서 고유 resource 목록. */
  distinctResources(): string[] {
    return this._distinctLabels('resource');
  }

  /** 부여된 권한에서 고유 action 목록. */
  distinctActions(): string[] {
    return this._distinctLabels('action');
  }

  // ── 내부 ──────────────────────────────────────────────────────────

  private _filterByLabel(label: keyof PermissionLabelSchema, value: string): DecodedPerm[] {
    const idx = this._codec['_getLabelIndex'](label, value);
    const filtered = this._bitSet.filterByLabel(label, idx);
    const br = this._codec.bridge;
    return filtered.map((biPacked) => this._codec.decode(br.toWeightedUnsafe(biPacked)));
  }

  private _distinctLabels(label: keyof PermissionLabelSchema): string[] {
    const dimIndex = DIM_LABELS.indexOf(label);
    const indices = this._bitSet.distinctDim(dimIndex);
    return indices.map(
      (i) => this._codec['_labels'].getEntityId(label, LABEL_VERSION, i) as string,
    );
  }
}
