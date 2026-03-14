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

import type { MetaRegistry } from "./meta-registry.js";
import type {
  AddressConfig,
  DimKind,
  EntityId,
  EntryFlag,
  DecodeMap,
  DimRange,
  IndexRange,
  MetaDataset,
} from "./types.js";

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
    const reg = this.registry;
    const def = reg.getIndexDef(indexId);
    const iv = reg.getIndexVersion(indexId, versionId);
    const wi = reg.getWeightedIndex(indexId, versionId);

    const dims = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const sn = reg.getDimSnapshot(dimId, snapshotId);
      const dimDef = reg.getDimDef(dimId);
      return {
        dimId,
        snapshotId,
        kind: dimDef.kind,
        entries: [...sn.entries] as EntityId[],
      };
    });

    const result: DecodeMap = {
      indexId,
      versionId,
      shape: [...wi.shape],
      size: wi.size,
      dims,
    };

    // address 설정이 있으면 포함 (캐싱된 값 사용)
    if (this._addressConfig) {
      result.address = structuredClone(this._addressConfig);
    }

    return result;
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
      const activeIndices: number[] = [];
      for (let i = 1; i <= sn.entries.length; i++) {
        const flag: EntryFlag | undefined = sn.entryFlags[i];
        if (!flag || flag.status === "active") activeIndices.push(i);
      }
      return {
        snapshotId,
        entries: [...sn.entries] as EntityId[],
        activeIndices,
        total: sn.entries.length,
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
        const activeIndices: number[] = [];
        for (let i = 1; i <= sn.entries.length; i++) {
          const flag: EntryFlag | undefined = sn.entryFlags[i];
          if (!flag || flag.status === "active") activeIndices.push(i);
        }
        return {
          dimId,
          snapshotId,
          kind: dimDef.kind,
          entries: [...sn.entries] as EntityId[],
          activeIndices,
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
