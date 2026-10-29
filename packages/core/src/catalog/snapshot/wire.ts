// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { CatalogSnapshotWire } from '../../types/envelope.js';
import type { CatalogSnapshot, CodecVersion } from './catalog-snapshot.types.js';
import type { SnapshotIdentity } from './compatibility.js';

/**
 * wire 문맥 → decode 판정 입력. codec_version은 검증 없이 넘긴다 —
 * 지원 여부는 resolveDecodeLayout이 UnsupportedCodecVersion으로 판정한다.
 */
export function toSnapshotIdentity(wire: CatalogSnapshotWire): SnapshotIdentity {
  return {
    catalogId: wire.catalog_id,
    digest: wire.digest,
    codecVersion: wire.codec_version as CodecVersion,
  };
}

/** 발행된 snapshot → SDK가 envelope에 싣는 wire 문맥 */
export function toSnapshotWire(snapshot: CatalogSnapshot): CatalogSnapshotWire {
  return {
    catalog_id: snapshot.catalogId,
    snapshot_version: snapshot.snapshotVersion,
    digest: snapshot.digest,
    codec_version: snapshot.codecVersion,
  };
}
