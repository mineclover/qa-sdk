// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * MetaCodecBig — BigInt 기반 독립 encode/decode 모듈
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * MetaCodec의 BigInt 대응 버전. WeightedIndexBig를 내부적으로 사용하여
 * Number.MAX_SAFE_INTEGER(2^53) 한계를 초과하는 주소 공간을 지원한다.
 *
 * ── 설계 결정 ────────────────────────────────────────────────────────────
 *
 * MetaCodec이 PrefixCodec + LabelRegistry에 위임하는 것과 달리,
 * MetaCodecBig는 WeightedIndexBig + 직접 label 매핑을 사용한다.
 * PrefixCodec/LabelRegistry는 Number 기반이므로 재사용할 수 없다.
 *
 * ── API ───────────────────────────────────────────────────────────────────
 *
 * encode(entityIds)   : { role: "admin", action: "read" } → VersionedValueBig
 * decode(vvb)         : VersionedValueBig → { role: "admin", action: "read" }
 * decodeValue(value)  : bigint → entity record
 * matchRanges(partial): 부분 조건 → [bigint, bigint][] 범위
 */

import { WeightedIndexBig, calcAddressRangesBig, type CoordConstraint } from 'weighted-index';
import type { DecodeMap, EntityId, VersionedValueBig } from './types.js';
import { EntryNotFoundError, ValidationError } from './errors.js';

/**
 * BigInt-aware DecodeMap 검증.
 * validateDecodeMap과 동일하지만 size 필드는 Number 캡 허용.
 */
function validateDecodeMapBig(map: DecodeMap): void {
  if (!map.indexId || typeof map.indexId !== 'string') {
    throw new ValidationError('DecodeMap.indexId must be a non-empty string');
  }
  if (!map.versionId || typeof map.versionId !== 'string') {
    throw new ValidationError('DecodeMap.versionId must be a non-empty string');
  }
  if (!Array.isArray(map.dims) || map.dims.length === 0) {
    throw new ValidationError('DecodeMap.dims must be a non-empty array');
  }
  if (!Array.isArray(map.shape) || map.shape.length !== map.dims.length) {
    throw new ValidationError(
      `DecodeMap.shape.length (${map.shape?.length ?? 0}) must equal dims.length (${map.dims.length})`,
    );
  }

  const seenDimIds = new Set<string>();

  for (let i = 0; i < map.dims.length; i++) {
    const dim = map.dims[i];
    if (!dim.dimId || typeof dim.dimId !== 'string') {
      throw new ValidationError(`DecodeMap.dims[${i}].dimId must be a non-empty string`);
    }
    if (!dim.snapshotId || typeof dim.snapshotId !== 'string') {
      throw new ValidationError(`DecodeMap.dims[${i}].snapshotId must be a non-empty string`);
    }
    if (seenDimIds.has(dim.dimId)) {
      throw new ValidationError(`DecodeMap.dims: duplicate dimId "${dim.dimId}"`);
    }
    seenDimIds.add(dim.dimId);
    if (map.shape[i] <= 0) {
      throw new ValidationError(`DecodeMap.shape[${i}] must be > 0, got ${map.shape[i]}`);
    }
    if (map.shape[i] !== dim.entries.length) {
      throw new ValidationError(
        `DecodeMap.shape[${i}] (${map.shape[i]}) must equal dims[${i}].entries.length (${dim.entries.length})`,
      );
    }
  }
  // size 검증 생략 — BigInt 곱이 Number.MAX_SAFE_INTEGER로 캡되는 경우 허용
}

export class MetaCodecBig {
  private readonly _wi: WeightedIndexBig;
  private readonly _map: DecodeMap;
  private readonly _dimIds: readonly string[];
  /** dim별 entityId → 1-based position (bigint) */
  private readonly _encodeMaps: ReadonlyMap<EntityId, bigint>[];

  constructor(map: DecodeMap) {
    validateDecodeMapBig(map);
    this._map = map;
    this._dimIds = Object.freeze(map.dims.map((d) => d.dimId));

    const shapeBig = map.shape.map((s) => BigInt(s));
    this._wi = new WeightedIndexBig(shapeBig, [...this._dimIds]);

    // entity → 1-based coord 매핑 빌드
    this._encodeMaps = map.dims.map((dim) => {
      const m = new Map<EntityId, bigint>();
      for (let i = 0; i < dim.entries.length; i++) {
        m.set(dim.entries[i], BigInt(i + 1));
      }
      return m;
    });
  }

  /**
   * entity ID 레코드 → VersionedValueBig.
   *
   * @example
   * codec.encode({ role: "admin", action: "read" })
   * // → { indexId: "perm", versionId: "v1", value: 0n }
   */
  encode(entityIds: Record<string, EntityId>): VersionedValueBig {
    const coords: bigint[] = new Array(this._map.dims.length);
    for (let i = 0; i < this._map.dims.length; i++) {
      const dim = this._map.dims[i];
      const entityId = entityIds[dim.dimId];
      if (entityId === undefined) {
        throw new ValidationError(
          `encode "${this._map.indexId}/${this._map.versionId}": missing dim "${dim.dimId}"`,
        );
      }
      const coord = this._encodeMaps[i].get(entityId);
      if (coord === undefined) {
        throw new EntryNotFoundError(
          `encode "${this._map.indexId}/${this._map.versionId}": entity "${entityId}" not found in dim "${dim.dimId}"`,
        );
      }
      coords[i] = coord;
    }
    return {
      indexId: this._map.indexId,
      versionId: this._map.versionId,
      value: this._wi.encode(coords),
    };
  }

  /**
   * VersionedValueBig → entity ID 레코드.
   */
  decode(vvb: VersionedValueBig): Readonly<Record<string, EntityId>> {
    if (vvb.indexId !== this._map.indexId || vvb.versionId !== this._map.versionId) {
      throw new ValidationError(
        `decode: expected "${this._map.indexId}/${this._map.versionId}", ` +
          `got "${vvb.indexId}/${vvb.versionId}"`,
      );
    }
    return this.decodeValue(vvb.value);
  }

  /**
   * bigint value → entity ID 레코드.
   */
  decodeValue(value: bigint): Readonly<Record<string, EntityId>> {
    const coords = this._wi.decode(value);
    const result: Record<string, EntityId> = {};
    for (let i = 0; i < coords.length; i++) {
      const idx = Number(coords[i]) - 1; // 1-based → 0-based
      result[this._map.dims[i].dimId] = this._map.dims[i].entries[idx];
    }
    return Object.freeze(result);
  }

  /**
   * 부분 조건에 매칭되는 value 범위 목록 (BigInt).
   */
  matchRanges(partial: Record<string, EntityId | null>): [bigint, bigint][] {
    const constraints: CoordConstraint[] = this._map.dims.map((dim) => {
      const val = partial[dim.dimId];
      if (val === undefined || val === null) return null;
      const idx = dim.entries.indexOf(val);
      if (idx === -1) {
        throw new EntryNotFoundError(
          `matchRanges "${this._map.indexId}/${this._map.versionId}": entity "${val}" not found in dim "${dim.dimId}"`,
        );
      }
      return String(idx + 1);
    });
    const shapeBig = this._map.shape.map((s) => BigInt(s));
    return calcAddressRangesBig(shapeBig, constraints);
  }

  /**
   * 다수의 bigint value를 한 번에 decode.
   */
  decodeBatch(values: readonly bigint[]): Readonly<Record<string, EntityId>>[] {
    return values.map((v) => this.decodeValue(v));
  }

  get indexId(): string {
    return this._map.indexId;
  }
  get versionId(): string {
    return this._map.versionId;
  }
  get size(): bigint {
    return this._wi.size;
  }
  get shape(): readonly bigint[] {
    return this._wi.shape;
  }
  get strides(): readonly bigint[] {
    return this._wi.strides;
  }
  get dimIds(): readonly string[] {
    return this._dimIds;
  }

  /** 내부 DecodeMap의 복사본 반환. */
  toDecodeMap(): DecodeMap {
    return structuredClone(this._map);
  }
}
