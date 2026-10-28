// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { PrefixLayout } from './catalog-snapshot.types.js';
import { CodecContractError } from './codec-errors.js';

/** core runtime decodePrefix의 headroom 표기와 같은 형식 */
export const RESERVED_ENTRY_PREFIX = '(reserved:' as const;

export function reservedEntryLabel(position: number): string {
  return `${RESERVED_ENTRY_PREFIX}${position})`;
}

export interface LayoutDecodeMapDim {
  readonly dimId: string;
  readonly snapshotId: string;
  readonly kind:
    | { readonly type: 'string_enum' }
    | { readonly type: 'index_ref'; readonly indexId: string };
  readonly entries: readonly string[];
}

/** index-meta DecodeMap과 구조적으로 호환되는 입력 (core는 index-meta에 의존하지 않는다) */
export interface LayoutDecodeMap {
  readonly indexId: string;
  readonly versionId: string;
  readonly dims: readonly LayoutDecodeMapDim[];
  readonly shape: readonly number[];
  readonly size: number;
}

/**
 * PrefixLayout → DecodeMap 정본 빌더 (ADR-010, D-1).
 * shape는 capacity, headroom position은 reserved entry로 채워 shape === entries.length를 유지한다.
 * table_ref는 주소 공간 밖이므로 포함하지 않는다 (core runtime과 동일).
 */
export function layoutToDecodeMap(layout: PrefixLayout): LayoutDecodeMap {
  if (!layout.safePrecision) {
    throw new CodecContractError(
      'StrideOverflow',
      `${layout.prefixId}@${layout.version}는 number DecodeMap으로 표현할 수 없습니다`,
      { totalSpace: layout.totalSpace },
    );
  }
  const dims = layout.dims.map((dim): LayoutDecodeMapDim => {
    const entries = Array.from({ length: dim.capacity }, (_, pos) =>
      pos < dim.entries.length ? String(dim.entries[pos]) : reservedEntryLabel(pos),
    );
    return dim.kind === 'axis'
      ? {
          dimId: dim.label,
          snapshotId: `${dim.sourceId}_${dim.sourceVersion}`,
          kind: { type: 'string_enum' },
          entries,
        }
      : {
          dimId: dim.label,
          snapshotId: `ref_${dim.sourceId}`,
          kind: { type: 'index_ref', indexId: dim.sourceId },
          entries,
        };
  });
  return {
    indexId: layout.prefixId,
    versionId: layout.version,
    dims,
    shape: layout.dims.map((d) => d.capacity),
    size: Number(layout.totalSpace),
  };
}
