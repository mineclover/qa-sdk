/**
 * MetaCodec — entries 기반 독립 encode/decode 모듈
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * DecodeMap(shape + entries) 하나만 받으면 MetaRegistry 없이 동작하는 경량 코덱.
 * 특정 index version에 특화되어 entity ID ↔ VersionedValue 변환을 수행한다.
 *
 * ── 내부 구현 ──────────────────────────────────────────────────────────────
 *
 * weighted-index의 LabelRegistry + PrefixRegistry에 위임한다.
 * - LabelRegistry : entity ID ↔ 1-based index 변환
 * - PrefixRegistry: 좌표 배열 ↔ 1차원 정수 변환 + entity ID 기반 encode/decode
 *
 * MetaCodec은 이 두 레지스트리를 DecodeMap에서 자동 빌드하고,
 * VersionedIndex ↔ VersionedValue 변환을 처리하는 얇은 어댑터다.
 *
 * ── API ───────────────────────────────────────────────────────────────────
 *
 * encode(entityIds)  : { role: "admin", action: "read" } → VersionedValue
 * decode(vv)         : VersionedValue → { role: "admin", action: "read" }
 */

import {
  createLabelRegistry,
  PrefixRegistry,
  type EntityId as WiEntityId,
  type LabelVersionEntry,
  EntityNotFoundError as WiEntityNotFoundError,
  CoordError,
} from "weighted-index";
import type { DecodeMap, EntityId, VersionedValue } from "./types.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";

export class MetaCodec {
  private readonly _prefix: PrefixRegistry;
  private readonly _map: DecodeMap;

  constructor(map: DecodeMap) {
    this._map = map;

    // DecodeMap → LabelRegistry
    const labelDefs: Record<string, LabelVersionEntry<WiEntityId>[]> = {};
    for (const dim of map.dims) {
      labelDefs[dim.dimId] = [{ version: dim.snapshotId, ids: [...dim.entries] }];
    }
    const labels = createLabelRegistry(labelDefs);

    // DecodeMap → PrefixRegistry
    this._prefix = new PrefixRegistry(labels, {
      [map.indexId]: {
        labels: map.dims.map((d) => d.dimId),
        versions: [
          {
            version: map.versionId,
            labelVersions: Object.fromEntries(
              map.dims.map((d) => [d.dimId, d.snapshotId])
            ),
          },
        ],
      },
    });
  }

  /**
   * entity ID 레코드 → VersionedValue.
   *
   * @example
   * codec.encode({ role: "admin", action: "read", resource: 10 })
   * // → { indexId: "perm", versionId: "v1", value: 0 }
   */
  encode(entityIds: Record<string, EntityId>): VersionedValue {
    try {
      const vi = this._prefix.encodeFromIds(
        this._map.indexId,
        entityIds,
        this._map.versionId
      );
      return { indexId: vi.prefix, versionId: vi.v, value: vi.id };
    } catch (e) {
      if (e instanceof WiEntityNotFoundError) {
        throw new EntryNotFoundError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      if (e instanceof CoordError) {
        throw new ValidationError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      throw e;
    }
  }

  /**
   * VersionedValue → entity ID 레코드.
   *
   * indexId/versionId가 이 코덱과 일치하는지 검증한다.
   * inactive entry도 항상 decode 가능하다.
   *
   * @example
   * codec.decode({ indexId: "perm", versionId: "v1", value: 0 })
   * // → { role: "admin", action: "read", resource: 10 }
   */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>> {
    if (vv.indexId !== this._map.indexId || vv.versionId !== this._map.versionId) {
      throw new ValidationError(
        `decode: expected "${this._map.indexId}/${this._map.versionId}", ` +
        `got "${vv.indexId}/${vv.versionId}"`
      );
    }
    return this.decodeValue(vv.value);
  }

  /**
   * value(정수) → entity ID 레코드.
   *
   * indexId/versionId 검증 없이 value만으로 decode.
   * 이미 indexId/versionId를 알고 있는 경우 사용.
   */
  decodeValue(value: number): Readonly<Record<string, EntityId>> {
    const ids = this._prefix.decodeToIds({
      prefix: this._map.indexId,
      v: this._map.versionId,
      id: value,
    });
    return Object.freeze(ids);
  }

  get indexId(): string {
    return this._map.indexId;
  }

  get versionId(): string {
    return this._map.versionId;
  }

  get size(): number {
    return this._map.size;
  }

  get shape(): readonly number[] {
    return this._map.shape;
  }

  /** 내부 DecodeMap의 복사본 반환. */
  toDecodeMap(): DecodeMap {
    return structuredClone(this._map);
  }
}
