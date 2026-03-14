/**
 * MetaResolver
 *
 * MetaRegistry의 데이터를 외부 소비용 번들로 변환한다.
 *
 * MetaRegistry가 core 로직(encode/decode/validate)을 담당한다면,
 * MetaResolver는 그 데이터를 **조회·전송·해석**에 최적화된 형태로 제공한다.
 *
 * 주요 용도:
 *   - DB에 디코딩 테이블 동기화 (DecodeMap)
 *   - 프론트엔드에 decode 번들 전송 (DecodeMap)
 *   - 버전 range 조회 — dim별 / index별 (DimRange, IndexRange)
 *   - 전체 데이터셋 내보내기 (MetaDataset)
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
