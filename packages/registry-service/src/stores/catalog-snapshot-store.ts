// @def.boundary registry-system
// @def.doc registry-system

import { AppError, canonicalJson, type CatalogSnapshot } from '@qa-sdk/core';

/**
 * 불변 CatalogSnapshot 저장소 (ADR-010).
 * - digest가 식별자 — 같은 digest에 다른 내용을 저장할 수 없다
 * - snapshotVersion은 catalog별로 단조 증가한다
 */
export interface CatalogSnapshotStore {
  /** 새로 저장하면 'created', 같은 내용이 이미 있으면 'exists'. 규칙 위반은 AppError CONFLICT(409) */
  publish(snapshot: CatalogSnapshot): Promise<'created' | 'exists'>;
  get(digest: string): Promise<CatalogSnapshot | undefined>;
  latest(catalogId: string): Promise<CatalogSnapshot | undefined>;
}

/** 두 구현이 공유하는 발행 규칙. 이미 같은 내용이면 'exists' */
export function checkPublishable(
  snapshot: CatalogSnapshot,
  existing: CatalogSnapshot | undefined,
  latest: CatalogSnapshot | undefined,
): 'new' | 'exists' {
  if (existing) {
    if (canonicalJson(existing) === canonicalJson(snapshot)) return 'exists';
    throw new AppError(
      'CONFLICT',
      `snapshot ${snapshot.digest}는 다른 내용으로 이미 발행되었습니다`,
      409,
    );
  }
  if (latest && snapshot.snapshotVersion <= latest.snapshotVersion) {
    throw new AppError(
      'CONFLICT',
      `${snapshot.catalogId} snapshotVersion은 ${latest.snapshotVersion}보다 커야 합니다: ${snapshot.snapshotVersion}`,
      409,
    );
  }
  return 'new';
}

export class InMemoryCatalogSnapshotStore implements CatalogSnapshotStore {
  private readonly byDigest = new Map<string, CatalogSnapshot>();
  private readonly latestByCatalog = new Map<string, string>();

  async publish(snapshot: CatalogSnapshot): Promise<'created' | 'exists'> {
    const latest = await this.latest(snapshot.catalogId);
    if (checkPublishable(snapshot, this.byDigest.get(snapshot.digest), latest) === 'exists') {
      return 'exists';
    }
    this.byDigest.set(snapshot.digest, structuredClone(snapshot));
    this.latestByCatalog.set(snapshot.catalogId, snapshot.digest);
    return 'created';
  }

  async get(digest: string): Promise<CatalogSnapshot | undefined> {
    const snapshot = this.byDigest.get(digest);
    return snapshot ? structuredClone(snapshot) : undefined;
  }

  async latest(catalogId: string): Promise<CatalogSnapshot | undefined> {
    const digest = this.latestByCatalog.get(catalogId);
    return digest ? this.get(digest) : undefined;
  }
}
