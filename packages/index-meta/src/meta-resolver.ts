// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * MetaResolver — 닫힌 패턴 스키마의 외부 소비 레이어
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * MetaRegistry가 1차원 주소의 압축·복원(encode/decode)을 담당한다면,
 * MetaResolver는 그 스키마 정보를 외부 시스템이 소비할 수 있는 형태로 제공한다.
 *
 * 핵심 용도는 DecodeMap이다. MetaRegistry 없이도 1차원 주소를 복원할 수 있는
 * 최소 번들(shape + entries)을 제공해, 별도 서비스나 DB가 자체적으로
 * 주소를 해석할 수 있게 한다.
 *
 * ── 주요 API ───────────────────────────────────────────────────────────────
 *
 *  getDecodeMap(indexId, versionId)  : 외부 독립 decode에 필요한 최소 번들
 *  getDimRange(dimId)                : dim의 모든 snapshot — 닫힌 집합의 버전 이력
 *  getIndexRange(indexId)            : index의 모든 version — 패턴 스키마의 버전 이력
 *  getDataset()                      : 전체 스키마 내보내기
 */

import { computeActiveIndices, snapshotCapacity, type MetaRegistry } from "./meta-registry.js";
import type {
  AddressConfig,
  EntityId,
  DecodeMap,
  DimRange,
  IndexRange,
  MetaDataset,
} from "./types.js";
import type { PrefixDecoderConfig } from "./prefix-decoder.js";

// ── MetaResolver ──────────────────────────────────────────────────────────────

export class MetaResolver {
  private readonly _addressConfig: AddressConfig | undefined;

  constructor(private readonly registry: MetaRegistry) {
    // address config를 한 번만 추출해 캐싱 (toInput의 반복 deep clone 방지)
    const input = registry.toInput();
    this._addressConfig = input.address;
  }

  /**
   * 특정 index version의 디코딩 최소 데이터 번들.
   *
   * 이 번들만 있으면 MetaRegistry 없이도 value → entity ID 복원이 가능하다.
   * address 설정이 있으면 PK 파싱 정보도 포함한다.
   *
   * @example
   * const map = resolver.getDecodeMap("perm", "v1");
   * // 외부 시스템에 전달 → shape + entries로 자체 decode
   */
  getDecodeMap(indexId: string, versionId: string): DecodeMap {
    const map = this.registry.createCodec(indexId, versionId).toDecodeMap();
    if (this._addressConfig) {
      map.address = structuredClone(this._addressConfig);
    }
    return map;
  }

  /**
   * 특정 index version의 DecodeMap + 참조 index의 DecodeMap 번들.
   *
   * index_ref dim이 있으면 해당 index의 최신 버전 DecodeMap도 포함한다.
   * 이 번들을 JSON으로 직렬화하면 마이크로서비스에서
   * `new PrefixDecoder(bundle)`로 바로 사용 가능하다.
   *
   * @example
   * const bundle = resolver.getDecodeMapBundle("article", "v1");
   * // JSON → 전송 → new PrefixDecoder(bundle)
   */
  getDecodeMapBundle(indexId: string, versionId: string): PrefixDecoderConfig {
    const map = this.getDecodeMap(indexId, versionId);
    const refs: Record<string, DecodeMap> = {};

    for (const dim of map.dims) {
      if (dim.kind.type === "index_ref") {
        const refIndexId = dim.kind.indexId;
        if (!refs[refIndexId]) {
          const refVersionIds = this.registry.getVersionIds(refIndexId);
          if (refVersionIds.length > 0) {
            const refVersionId = refVersionIds[refVersionIds.length - 1];
            refs[refIndexId] = this.getDecodeMap(refIndexId, refVersionId);
          }
        }
      }
    }

    return {
      map,
      refs: Object.keys(refs).length > 0 ? refs : undefined,
    };
  }

  /**
   * dim의 모든 snapshot 데이터 (버전 range).
   *
   * @example
   * const range = resolver.getDimRange("role");
   * // range.snapshots = [{ snapshotId: "v1", entries: [...], ... }, { snapshotId: "v2", ... }]
   */
  getDimRange(dimId: string): DimRange {
    const reg = this.registry;
    const dimDef = reg.getDimDef(dimId);
    const snapshotIds = reg.getSnapshotIds(dimId);

    const snapshots = snapshotIds.map((snapshotId) => {
      const sn = reg.getDimSnapshot(dimId, snapshotId);
      const capacity = snapshotCapacity(sn);
      return {
        snapshotId,
        entries: [...sn.entries] as EntityId[],
        activeIndices: computeActiveIndices(sn),
        total: sn.entries.length,
        capacity,
        headroom: capacity - sn.entries.length,
      };
    });

    return {
      dimId,
      kind: dimDef.kind,
      description: dimDef.description,
      snapshots,
    };
  }

  /**
   * index의 모든 version 데이터 (버전 range).
   *
   * @example
   * const range = resolver.getIndexRange("perm");
   * // range.versions[0].shape = [3, 3, 3]
   * // range.versions[1].shape = [4, 3, 3]  ← role dim 확장
   */
  getIndexRange(indexId: string): IndexRange {
    const reg = this.registry;
    const def = reg.getIndexDef(indexId);
    const versionIds = reg.getVersionIds(indexId);

    const versions = versionIds.map((versionId) => {
      const iv = reg.getIndexVersion(indexId, versionId);
      const wi = reg.getWeightedIndex(indexId, versionId);

      const dims = def.dims.map((dimId) => {
        const snapshotId = iv.snapshots[dimId];
        const sn = reg.getDimSnapshot(dimId, snapshotId);
        const dimDef = reg.getDimDef(dimId);
        const capacity = snapshotCapacity(sn);
        return {
          dimId,
          snapshotId,
          kind: dimDef.kind,
          entries: [...sn.entries] as EntityId[],
          activeIndices: computeActiveIndices(sn),
          capacity,
          headroom: capacity - sn.entries.length,
        };
      });

      return {
        versionId,
        shape: [...wi.shape],
        size: wi.size,
        dims,
      };
    });

    return {
      indexId,
      description: def.description,
      dimIds: [...def.dims],
      versions,
    };
  }

  /**
   * 전체 레지스트리의 구조화된 데이터셋.
   * index별 + dim별로 모든 version/snapshot을 한 번에 내보낸다.
   *
   * @example
   * const dataset = resolver.getDataset();
   * // dataset.indices = [{ indexId: "perm", versions: [...] }, ...]
   * // dataset.dims = [{ dimId: "role", snapshots: [...] }, ...]
   */
  getDataset(): MetaDataset {
    const reg = this.registry;
    return {
      indices: reg.indexIds.map((id) => this.getIndexRange(id)),
      dims: reg.dimIds.map((id) => this.getDimRange(id)),
    };
  }
}
