// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { CatalogSnapshot } from '../catalog/snapshot/catalog-snapshot.types.js';

/** Snapshot 발행 결과. 저장소 backend와 무관하게 동일한 결과를 반환한다. */
export type CatalogSnapshotPublishResult = 'created' | 'exists';

/** Snapshot 발행 충돌의 논리 원인. HTTP/AppError 코드는 adapter가 결정한다. */
export type CatalogSnapshotConflictCode = 'digest-content-mismatch' | 'version-not-increasing';

export interface CatalogSnapshotConflict {
  readonly code: CatalogSnapshotConflictCode;
  readonly catalogId: string;
  readonly digest: string;
  readonly attemptedVersion: number;
  readonly existingVersion?: number;
}

/**
 * 불변 CatalogSnapshot의 논리 저장 계약.
 *
 * 이 포트는 DB 종류, 직렬화 방식, 네트워크 전송을 소유하지 않는다.
 * 구현체는 같은 digest의 동일 payload를 멱등적으로 `exists`로 처리하고,
 * catalog별 snapshotVersion 단조 증가 규칙을 보장해야 한다.
 */
export interface CatalogSnapshotStore {
  publish(snapshot: CatalogSnapshot): Promise<CatalogSnapshotPublishResult>;
  get(digest: string): Promise<CatalogSnapshot | undefined>;
  latest(catalogId: string): Promise<CatalogSnapshot | undefined>;
}
