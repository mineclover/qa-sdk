// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type {
  CatalogSnapshot,
  CatalogSnapshotRef,
  PrefixLayout,
  PrefixLayoutKey,
} from './catalog-snapshot.types.js';
import { isSupportedCodecVersion, prefixLayoutKey } from './catalog-snapshot.types.js';
import { CodecContractError } from './codec-errors.js';

export type LayoutBreakingReason =
  | 'address-model'
  | 'dim-order'
  | 'dim-kind'
  | 'dim-source'
  | 'capacity'
  | 'entries-rewritten';

export type LayoutChange =
  | { readonly kind: 'identical' }
  | { readonly kind: 'append-compatible'; readonly appended: Readonly<Record<string, number>> }
  | { readonly kind: 'breaking'; readonly reason: LayoutBreakingReason; readonly label?: string };

export interface UnversionedBreakingChange {
  readonly key: PrefixLayoutKey;
  readonly reason: LayoutBreakingReason | 'removed';
  readonly label?: string;
}

/**
 * prev layout으로 만든 주소를 next layout으로 decode해도 같은 의미인지 분류한다.
 * 같은 stride에서 entry를 뒤에 추가한 경우만 호환이다 (feedback: stride 순서 변경은 주소 공간을 바꾼다).
 */
export function classifyLayoutChange(prev: PrefixLayout, next: PrefixLayout): LayoutChange {
  if (prev.addressModel !== next.addressModel) return { kind: 'breaking', reason: 'address-model' };
  if (
    prev.dims.length !== next.dims.length ||
    prev.dims.some((dim, i) => dim.label !== next.dims[i].label)
  ) {
    return { kind: 'breaking', reason: 'dim-order' };
  }

  const appended: Record<string, number> = {};
  for (let i = 0; i < prev.dims.length; i++) {
    const before = prev.dims[i];
    const after = next.dims[i];
    const label = before.label;
    if (before.kind !== after.kind) return { kind: 'breaking', reason: 'dim-kind', label };
    if (before.sourceId !== after.sourceId)
      return { kind: 'breaking', reason: 'dim-source', label };
    if (before.capacity !== after.capacity) return { kind: 'breaking', reason: 'capacity', label };
    const isPrefix =
      before.entries.length <= after.entries.length &&
      before.entries.every((entry, pos) => after.entries[pos] === entry);
    if (!isPrefix) return { kind: 'breaking', reason: 'entries-rewritten', label };
    if (after.entries.length > before.entries.length) {
      appended[label] = after.entries.length - before.entries.length;
    }
  }

  return Object.keys(appended).length === 0
    ? { kind: 'identical' }
    : { kind: 'append-compatible', appended };
}

/** 같은 prefix version 안에서 일어난 breaking 변경 — 새 prefix version을 요구해야 하는 목록 */
export function findUnversionedBreakingChanges(
  prev: CatalogSnapshot,
  next: CatalogSnapshot,
): UnversionedBreakingChange[] {
  const changes: UnversionedBreakingChange[] = [];
  for (const key of Object.keys(prev.layouts).sort() as PrefixLayoutKey[]) {
    const after = next.layouts[key];
    if (!after) {
      changes.push({ key, reason: 'removed' });
      continue;
    }
    const change = classifyLayoutChange(prev.layouts[key], after);
    if (change.kind === 'breaking') {
      changes.push(
        change.label === undefined
          ? { key, reason: change.reason }
          : { key, reason: change.reason, label: change.label },
      );
    }
  }
  return changes;
}

/**
 * decode 판정에 필요한 생성 문맥. snapshotVersion은 registry가 발급하는 표시용 순번이라
 * codegen 시점에 알 수 없으므로 판정 입력에서 제외한다 (식별은 digest).
 */
export type SnapshotIdentity = Pick<CatalogSnapshotRef, 'catalogId' | 'digest' | 'codecVersion'>;

export interface DecodeLayoutRequest {
  /** 주소를 생성한 snapshot 문맥 (wire에서 받은 값이면 codecVersion은 임의 문자열일 수 있다) */
  readonly ref: SnapshotIdentity;
  readonly prefixId: string;
  readonly version: string;
}

/** digest → snapshot 조회 (registry read-through cache 등). 없으면 undefined */
export type SnapshotLookup = (digest: string) => CatalogSnapshot | undefined;

/**
 * 주소의 생성 문맥(ref)을 target snapshot으로 decode해도 되는지 판정하고 사용할 layout을 돌려준다.
 * migration map 없는 best-effort decode는 허용하지 않는다.
 */
export function resolveDecodeLayout(
  request: DecodeLayoutRequest,
  target: CatalogSnapshot,
  lookup: SnapshotLookup,
): PrefixLayout {
  const { ref, prefixId, version } = request;
  if (!isSupportedCodecVersion(ref.codecVersion) || ref.codecVersion !== target.codecVersion) {
    throw new CodecContractError(
      'UnsupportedCodecVersion',
      `지원하지 않는 codec: ${ref.codecVersion}`,
      {
        codecVersion: ref.codecVersion,
        targetCodecVersion: target.codecVersion,
      },
    );
  }
  if (ref.catalogId !== target.catalogId) {
    throw new CodecContractError(
      'CatalogMismatch',
      `catalog가 다릅니다: ${ref.catalogId} ≠ ${target.catalogId}`,
      {
        catalogId: ref.catalogId,
        targetCatalogId: target.catalogId,
      },
    );
  }

  const key = prefixLayoutKey(prefixId, version);
  const targetLayout = target.layouts[key];
  if (!targetLayout) {
    throw new CodecContractError('UnknownPrefix', `target snapshot에 layout이 없습니다: ${key}`, {
      key,
      digest: target.digest,
    });
  }
  if (ref.digest === target.digest) return targetLayout;

  const producer = lookup(ref.digest);
  if (!producer) {
    throw new CodecContractError(
      'UnknownCatalogSnapshot',
      `생성 snapshot을 찾을 수 없습니다: ${ref.digest}`,
      {
        digest: ref.digest,
      },
    );
  }
  if (producer.catalogId !== target.catalogId) {
    throw new CodecContractError(
      'CatalogMismatch',
      `생성 snapshot의 catalog가 다릅니다: ${producer.catalogId}`,
      {
        catalogId: producer.catalogId,
        targetCatalogId: target.catalogId,
      },
    );
  }
  const producerLayout = producer.layouts[key];
  if (!producerLayout) {
    throw new CodecContractError('UnknownPrefix', `생성 snapshot에 layout이 없습니다: ${key}`, {
      key,
      digest: producer.digest,
    });
  }

  const change = classifyLayoutChange(producerLayout, targetLayout);
  if (change.kind === 'breaking') {
    throw new CodecContractError(
      'MigrationRequired',
      `${key} layout이 호환되지 않습니다 (${change.reason})`,
      {
        key,
        reason: change.reason,
        label: change.label,
        fromDigest: producer.digest,
        toDigest: target.digest,
      },
    );
  }
  return targetLayout;
}

/** 주소가 layout 주소 공간 [0, totalSpace) 안의 정수인지 검사한다 */
export function assertAddressInLayout(layout: PrefixLayout, address: number | bigint): void {
  const key = prefixLayoutKey(layout.prefixId, layout.version);
  if (typeof address === 'number') {
    if (!Number.isSafeInteger(address) || address < 0) {
      throw new CodecContractError(
        'AddressOutOfRange',
        `${key} 주소는 0 이상의 안전한 정수여야 합니다: ${address}`,
        {
          key,
          address,
        },
      );
    }
    if (!layout.safePrecision) {
      throw new CodecContractError(
        'StrideOverflow',
        `${key} 주소 공간이 2^53을 넘습니다 — bigint 주소를 사용하세요`,
        {
          key,
          totalSpace: layout.totalSpace,
        },
      );
    }
  }
  const value = BigInt(address);
  if (value < 0n || value >= BigInt(layout.totalSpace)) {
    throw new CodecContractError(
      'AddressOutOfRange',
      `${key} 주소는 [0, ${layout.totalSpace}) 범위여야 합니다: ${value}`,
      {
        key,
        address: String(value),
        totalSpace: layout.totalSpace,
      },
    );
  }
}
