// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * permission-set.ts — 비트마스크 기반 권한 관리 엔진.
 *
 * weighted-index의 빌딩 블록을 조합하여 [feature, role] 차원의
 * 권한 상태를 O(1)로 검사하고 Uint8Array로 직렬화한다.
 *
 * 설계 원칙:
 *  - 내부 차원: feature × role (weighted-index로 압축)
 *  - 외부 차원: env, region 등은 호출자가 주입 (마스크 라우팅)
 *  - 권한 상태: 0/1 bitmask — grant/deny per address
 */

import {
  WeightedIndex,
  createMask,
  setBit,
  clearBit,
  hasBit,
  hasAnyBit,
  popcount,
  maskAnd,
  maskOr,
  calcAddressRanges,
  expandRanges,
  type CoordConstraint,
} from 'weighted-index';

// ── Types ────────────────────────────────────────────────────────────────────

/** 차원 정의. ID 목록의 순서가 1-based 인덱스가 된다. */
export interface DimDef<T extends string = string> {
  readonly name: string;
  readonly ids: readonly T[];
}

/** PermissionSet 생성 옵션. */
export interface PermissionSetOptions {
  /** 기능/리소스 차원 (dim 0). */
  features: DimDef;
  /** 역할 차원 (dim 1). */
  roles: DimDef;
  /** 초기 마스크. 미지정 시 전체 deny. */
  mask?: Uint8Array;
}

/** 직렬화된 형태. */
export interface PermissionSetSnapshot {
  features: readonly string[];
  roles: readonly string[];
  /** base64 인코딩된 마스크. */
  mask: string;
}

// ── PermissionSet ────────────────────────────────────────────────────────────

export class PermissionSet {
  /** 내부 WeightedIndex — shape = [features.length, roles.length]. */
  readonly index: WeightedIndex;
  /** 비트마스크 — address당 1비트. */
  readonly mask: Uint8Array;

  private readonly _featureIds: readonly string[];
  private readonly _roleIds: readonly string[];
  private readonly _featureMap: ReadonlyMap<string, number>; // id → 1-based
  private readonly _roleMap: ReadonlyMap<string, number>; // id → 1-based

  constructor(opts: PermissionSetOptions) {
    if (opts.features.ids.length === 0) throw new RangeError('features must not be empty');
    if (opts.roles.ids.length === 0) throw new RangeError('roles must not be empty');

    this._featureIds = opts.features.ids;
    this._roleIds = opts.roles.ids;

    this._featureMap = _buildIdMap(opts.features.ids);
    this._roleMap = _buildIdMap(opts.roles.ids);

    this.index = new WeightedIndex([this._featureIds.length, this._roleIds.length]);

    if (opts.mask) {
      const expected = Math.ceil(this.index.size / 8);
      if (opts.mask.length !== expected) {
        throw new RangeError(`Mask length ${opts.mask.length} !== expected ${expected}`);
      }
      this.mask = opts.mask;
    } else {
      this.mask = createMask(this.index.size);
    }
  }

  // ── 기본 정보 ──────────────────────────────────────────────────────────────

  /** 전체 슬롯 수 (features × roles). */
  get size(): number {
    return this.index.size;
  }

  /** 현재 부여된 권한 수. */
  get grantCount(): number {
    return popcount(this.mask);
  }

  get features(): readonly string[] {
    return this._featureIds;
  }
  get roles(): readonly string[] {
    return this._roleIds;
  }

  // ── 단일 조작 ──────────────────────────────────────────────────────────────

  /** 권한 부여. */
  grant(feature: string, role: string): void {
    setBit(this.mask, this._addr(feature, role));
  }

  /** 권한 회수. */
  revoke(feature: string, role: string): void {
    clearBit(this.mask, this._addr(feature, role));
  }

  /** 권한 보유 여부. O(1). */
  has(feature: string, role: string): boolean {
    return hasBit(this.mask, this._addr(feature, role));
  }

  // ── 배치 조작 ──────────────────────────────────────────────────────────────

  /** 특정 기능에 대해 모든 역할에 부여. */
  grantAllRoles(feature: string): void {
    for (const role of this._roleIds) this.grant(feature, role);
  }

  /** 특정 기능에 대해 지정된 역할들에 부여. */
  grantRoles(feature: string, roles: readonly string[]): void {
    for (const role of roles) this.grant(feature, role);
  }

  /** 특정 기능에 대해 모든 역할 회수. */
  revokeAllRoles(feature: string): void {
    for (const role of this._roleIds) this.revoke(feature, role);
  }

  /** 특정 역할에 대해 모든 기능 부여. */
  grantAllFeatures(role: string): void {
    for (const feat of this._featureIds) this.grant(feat, role);
  }

  /** 특정 역할에 대해 모든 기능 회수. */
  revokeAllFeatures(role: string): void {
    for (const feat of this._featureIds) this.revoke(feat, role);
  }

  /** 전체 초기화 (모든 권한 회수). */
  revokeAll(): void {
    this.mask.fill(0);
  }

  /** 전체 부여. */
  grantAll(): void {
    this.mask.fill(0xff);
    // 마지막 바이트의 여분 비트 클리어
    const rem = this.index.size % 8;
    if (rem > 0) {
      this.mask[this.mask.length - 1] &= (1 << rem) - 1;
    }
  }

  // ── 쿼리 ───────────────────────────────────────────────────────────────────

  /** 이 기능에 접근 가능한 역할 목록. */
  rolesFor(feature: string): string[] {
    const result: string[] = [];
    for (const role of this._roleIds) {
      if (this.has(feature, role)) result.push(role);
    }
    return result;
  }

  /** 이 역할이 접근 가능한 기능 목록. */
  featuresFor(role: string): string[] {
    const result: string[] = [];
    for (const feat of this._featureIds) {
      if (this.has(feat, role)) result.push(feat);
    }
    return result;
  }

  /** 주어진 역할 중 하나라도 이 기능에 접근 가능한지. */
  hasAnyRole(feature: string, roles: readonly string[]): boolean {
    const addrs = roles.map((r) => this._addr(feature, r));
    return hasAnyBit(this.mask, addrs);
  }

  /**
   * 와일드카드 범위 쿼리.
   * constraint 배열의 각 원소는 CoordConstraint (null=전체, "3"=단일, "1-3,5"=범위).
   * 차원 순서: [feature, role].
   */
  queryRange(constraints: [CoordConstraint, CoordConstraint]): number[] {
    const ranges = calcAddressRanges(this.index.shape, constraints);
    return expandRanges(ranges);
  }

  /**
   * 범위에 해당하는 주소 중 부여된 것만 반환.
   */
  queryGranted(constraints: [CoordConstraint, CoordConstraint]): number[] {
    return this.queryRange(constraints).filter((addr) => hasBit(this.mask, addr));
  }

  // ── 마스크 대수 ─────────────────────────────────────────────────────────────

  /** 두 PermissionSet의 교집합 (둘 다 부여된 것만). */
  intersect(other: PermissionSet): PermissionSet {
    this._assertCompatible(other);
    return new PermissionSet({
      features: { name: 'features', ids: this._featureIds },
      roles: { name: 'roles', ids: this._roleIds },
      mask: maskAnd(this.mask, other.mask),
    });
  }

  /** 두 PermissionSet의 합집합 (둘 중 하나라도 부여된 것). */
  union(other: PermissionSet): PermissionSet {
    this._assertCompatible(other);
    return new PermissionSet({
      features: { name: 'features', ids: this._featureIds },
      roles: { name: 'roles', ids: this._roleIds },
      mask: maskOr(this.mask, other.mask),
    });
  }

  // ── 매트릭스 뷰 ────────────────────────────────────────────────────────────

  /** boolean[][] 매트릭스 반환. matrix[featureIdx][roleIdx]. */
  toMatrix(): boolean[][] {
    return this._featureIds.map((_f, fi) =>
      this._roleIds.map((_r, ri) => hasBit(this.mask, this.index.encode([fi + 1, ri + 1]))),
    );
  }

  /** 매트릭스에서 복원. */
  static fromMatrix(features: DimDef, roles: DimDef, matrix: boolean[][]): PermissionSet {
    const ps = new PermissionSet({ features, roles });
    for (let fi = 0; fi < features.ids.length; fi++) {
      for (let ri = 0; ri < roles.ids.length; ri++) {
        if (matrix[fi]?.[ri]) {
          setBit(ps.mask, ps.index.encode([fi + 1, ri + 1]));
        }
      }
    }
    return ps;
  }

  // ── 직렬화 ─────────────────────────────────────────────────────────────────

  /** 스냅샷으로 직렬화. */
  toSnapshot(): PermissionSetSnapshot {
    return {
      features: this._featureIds,
      roles: this._roleIds,
      mask: _uint8ToBase64(this.mask),
    };
  }

  /** 스냅샷에서 복원. */
  static fromSnapshot(snap: PermissionSetSnapshot): PermissionSet {
    return new PermissionSet({
      features: { name: 'features', ids: snap.features },
      roles: { name: 'roles', ids: snap.roles },
      mask: _base64ToUint8(snap.mask),
    });
  }

  /** raw bytes 직렬화. */
  toBytes(): Uint8Array {
    return new Uint8Array(this.mask);
  }

  /** raw bytes에서 복원. */
  static fromBytes(features: DimDef, roles: DimDef, bytes: Uint8Array): PermissionSet {
    return new PermissionSet({ features, roles, mask: new Uint8Array(bytes) });
  }

  // ── 복제 ───────────────────────────────────────────────────────────────────

  clone(): PermissionSet {
    return new PermissionSet({
      features: { name: 'features', ids: this._featureIds },
      roles: { name: 'roles', ids: this._roleIds },
      mask: new Uint8Array(this.mask),
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _addr(feature: string, role: string): number {
    const fi = this._featureMap.get(feature);
    if (fi === undefined) throw new RangeError(`Unknown feature: "${feature}"`);
    const ri = this._roleMap.get(role);
    if (ri === undefined) throw new RangeError(`Unknown role: "${role}"`);
    return this.index.encode([fi, ri]);
  }

  private _assertCompatible(other: PermissionSet): void {
    if (this.mask.length !== other.mask.length) {
      throw new RangeError(
        `Incompatible PermissionSet: mask length ${this.mask.length} vs ${other.mask.length}`,
      );
    }
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function _buildIdMap(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    if (m.has(ids[i])) throw new RangeError(`Duplicate id: "${ids[i]}"`);
    m.set(ids[i], i + 1); // 1-based for WeightedIndex
  }
  return m;
}

// ── Base64 (환경 독립) ───────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function _uint8ToBase64(arr: Uint8Array): string {
  let out = '';
  for (let i = 0; i < arr.length; i += 3) {
    const b0 = arr[i],
      b1 = arr[i + 1] ?? 0,
      b2 = arr[i + 2] ?? 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < arr.length ? B64[((b1 & 0xf) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < arr.length ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

function _base64ToUint8(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    bytes[j++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[j++] = ((b & 0xf) << 4) | (c >> 2);
    if (d >= 0) bytes[j++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, j);
}
