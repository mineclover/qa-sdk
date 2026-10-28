// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { AddressModel } from '../catalog.types.js';
import type { CATALOG_DIGEST_ALGORITHM } from './digest.js';

export const CATALOG_SNAPSHOT_SCHEMA_VERSION = 1 as const;

/** 현재 `prefix:version:address` 형식과 capacity 기준 mixed-radix codec */
export const LEGACY_V1_CODEC = 'legacy-v1' as const;
export const SUPPORTED_CODEC_VERSIONS = [LEGACY_V1_CODEC] as const;
export type CodecVersion = (typeof SUPPORTED_CODEC_VERSIONS)[number];

export function isSupportedCodecVersion(value: string): value is CodecVersion {
  return (SUPPORTED_CODEC_VERSIONS as readonly string[]).includes(value);
}

export type PrefixLayoutKey = `${string}@${string}`;

export function prefixLayoutKey(prefixId: string, version: string): PrefixLayoutKey {
  return `${prefixId}@${version}`;
}

/** 주소 공간을 구성하는 고정 차원 1개 (table_ref는 주소 공간에 포함되지 않음) */
export interface DimensionLayout {
  readonly label: string;
  readonly kind: 'axis' | 'prefix_ref';
  /** axis: axisId, prefix_ref: 참조 prefixId */
  readonly sourceId: string;
  /** axis: 축 version, prefix_ref: refEntries.refVersion (미선언 시 null) */
  readonly sourceVersion: string | null;
  /** headroom 포함 capacity — stride 계산 기준 */
  readonly capacity: number;
  /** position 순서의 실제 entry (capacity보다 짧을 수 있음) */
  readonly entries: readonly (string | number)[];
}

export interface PrefixLayout {
  readonly prefixId: string;
  readonly version: string;
  readonly addressModel: AddressModel;
  readonly dims: readonly DimensionLayout[];
  /** dims와 같은 순서, 10진 문자열 (2^53 초과 대비) */
  readonly strides: readonly string[];
  readonly totalSpace: string;
  /** 최대 주소(totalSpace - 1)가 Number.MAX_SAFE_INTEGER 이하 */
  readonly safePrecision: boolean;
  /** prefixId·version·addressModel·dims의 canonical digest */
  readonly layoutDigest: string;
}

export interface CatalogSnapshotRef {
  readonly catalogId: string;
  /** registry가 발급하는 단조 증가 정수 (문서 version과 별개 축) */
  readonly snapshotVersion: number;
  readonly digest: string;
  readonly codecVersion: CodecVersion;
}

export interface CatalogSnapshot extends CatalogSnapshotRef {
  readonly schemaVersion: typeof CATALOG_SNAPSHOT_SCHEMA_VERSION;
  readonly digestAlgorithm: typeof CATALOG_DIGEST_ALGORITHM;
  readonly parentDigest: string | null;
  readonly layouts: Readonly<Record<PrefixLayoutKey, PrefixLayout>>;
}

export interface SnapshotLayoutIssue {
  readonly key: PrefixLayoutKey;
  readonly message: string;
}

export interface CatalogSnapshotBuildResult {
  readonly snapshot: CatalogSnapshot;
  /** layout을 만들 수 없어 layouts에서 제외한 prefix version */
  readonly issues: readonly SnapshotLayoutIssue[];
}

export interface BuildCatalogSnapshotOptions {
  readonly snapshotVersion: number;
  readonly parentDigest: string | null;
  readonly codecVersion?: CodecVersion;
}
