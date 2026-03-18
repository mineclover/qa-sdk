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
  createMask,
  setBit,
  clearBit,
  hasBit,
  popcount,
} from "weighted-index";

import {
  formatPermCode,
  parsePermCode,
  type PermissionCode,
} from "./permission-code.js";
import type { ServiceContext } from "./service-ref.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** 코덱 차원 정의. 등록된 ID 목록 순서가 1-based 인덱스가 된다. */
export interface CodecDims {
  services: readonly string[];   // "shop/payment", "cms/auth", ...
  types: readonly string[];      // "api", "page", "action"
  resources: readonly string[];  // "admin/teams", "billing/invoices", ...
  actions: readonly string[];    // "GET", "POST", "view", "edit", ...
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

// ── 내부 상수 ────────────────────────────────────────────────────────────────

const LABEL_VERSION = "v1";
const DIM_LABELS = ["service", "type", "resource", "action"] as const;

// ── PermissionCodec ──────────────────────────────────────────────────────────

export class PermissionCodec {
  /** 내부 WeightedIndex — shape = [services, types, resources, actions]. */
  readonly index: WeightedIndex;
  readonly version: string;

  private readonly _dims: CodecDims;
  /** D-1: LabelRegistry에 위임하여 string→index 맵 중복 제거 */
  private readonly _labels: LabelRegistry;

  constructor(version: string, dims: CodecDims) {
    this.version = version;
    this._dims = dims;

    // CodecDims → LabelRegistry 변환
    this._labels = createLabelRegistry({
      service:  [{ version: LABEL_VERSION, ids: [...dims.services] }],
      type:     [{ version: LABEL_VERSION, ids: [...dims.types] }],
      resource: [{ version: LABEL_VERSION, ids: [...dims.resources] }],
      action:   [{ version: LABEL_VERSION, ids: [...dims.actions] }],
    });

    this.index = new WeightedIndex([
      dims.services.length,
      dims.types.length,
      dims.resources.length,
      dims.actions.length,
    ]);
  }

  /** 전체 슬롯 수. */
  get size(): number { return this.index.size; }

  get dims(): CodecDims { return this._dims; }

  // ── Tier 1 → Tier 2: text → integer ────────────────────────────────────

  /** permission code 문자열 → integer address. */
  encode(text: string): number {
    const code = parsePermCode(text);
    return this.encodeCode(code);
  }

  /** PermissionCode 객체 → integer address. */
  encodeCode(code: PermissionCode): number {
    return this.index.encode([
      this._labels.getIndex("service", LABEL_VERSION, code.service),
      this._labels.getIndex("type", LABEL_VERSION, code.type),
      this._labels.getIndex("resource", LABEL_VERSION, code.resource),
      this._labels.getIndex("action", LABEL_VERSION, code.action),
    ]);
  }

  /** 개별 파트 → integer address. */
  encodeRaw(service: string, type: string, resource: string, action: string): number {
    return this.index.encode([
      this._labels.getIndex("service", LABEL_VERSION, service),
      this._labels.getIndex("type", LABEL_VERSION, type),
      this._labels.getIndex("resource", LABEL_VERSION, resource),
      this._labels.getIndex("action", LABEL_VERSION, action),
    ]);
  }

  // ── Tier 2 → Tier 1: integer → text ────────────────────────────────────

  /** integer address → DecodedPerm. */
  decode(address: number): DecodedPerm {
    const coords = this.index.decode(address);
    return {
      service:  this._labels.getEntityId("service", LABEL_VERSION, coords[0]) as string,
      type:     this._labels.getEntityId("type", LABEL_VERSION, coords[1]) as string,
      resource: this._labels.getEntityId("resource", LABEL_VERSION, coords[2]) as string,
      action:   this._labels.getEntityId("action", LABEL_VERSION, coords[3]) as string,
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
  serialize(address: number, schema = "perm"): string {
    return `${schema}:${this.version}:${address}`;
  }

  /** "perm:v2:42" → integer address. 버전 검증 포함. */
  parse(serialized: string): number {
    const parts = serialized.split(":");
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
  grantRaw(mask: Uint8Array, service: string, type: string, resource: string, action: string): void {
    setBit(mask, this.encodeRaw(service, type, resource, action));
  }

  /** bitmask에서 raw 파트로 권한 확인. */
  checkRaw(mask: Uint8Array, service: string, type: string, resource: string, action: string): boolean {
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
}
