/**
 * CrossVersionEntrySync — prefix의 모든 활성 버전에 entry를 동기 전파
 *
 * Position 불변식: 모든 버전에서 position N은 항상 position N이다.
 * active 버전이 position을 결정하고 (SSOT), 나머지 writable 버전에 동일 position으로 전파.
 *
 * MigrationStore와 무관 — 마이그레이션은 오직 release 시 EntityId 수정/비활성화만 추적.
 */

import type { EntityId } from "./types.js";
import type { VersionLifecycleStore } from "./version-lifecycle.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import type { EntryCache } from "./entry-cache.js";
import { ValidationError } from "./errors.js";

// ── 결과 타입 ────────────────────────────────────────────

export interface CrossVersionAddResult {
  /** 할당된 position (모든 버전 동일) */
  readonly position: number;
  /** entry가 추가된 버전 목록 */
  readonly added: readonly string[];
  /** 건너뛴 버전 */
  readonly skipped: ReadonlyArray<{ versionId: string; reason: string }>;
}

// ── CrossVersionEntrySync ────────────────────────────────

export class CrossVersionEntrySync {
  private readonly _versions: VersionLifecycleStore;
  private readonly _store: IndexMetaStore;
  private readonly _cache: EntryCache;

  constructor(
    versions: VersionLifecycleStore,
    store: IndexMetaStore,
    cache: EntryCache,
  ) {
    this._versions = versions;
    this._store = store;
    this._cache = cache;
  }

  /**
   * prefix의 모든 writable 버전에 entry 추가.
   *
   * 1. active 버전에서 다음 position 결정 (SSOT)
   * 2. 동일 position으로 모든 draft/released/active 버전에 전파
   * 3. capacity 부족한 버전은 skip (경고)
   * 4. active 버전에서 이미 존재하면 기존 position 반환 (idempotent)
   */
  async addEntry(prefix: string, value: EntityId): Promise<CrossVersionAddResult> {
    // 1. active 버전 확인
    const active = await this._versions.getActive(prefix);
    if (!active) {
      throw new ValidationError(`No active version for prefix "${prefix}"`);
    }

    // 2. active 버전에서 중복 체크
    const existingPos = await this._cache.getByValue(prefix, active.versionId, value);
    if (existingPos !== null) {
      return { position: existingPos, added: [], skipped: [] };
    }

    // 3. active 버전에서 다음 position 결정
    const entries = await this._cache.getAll(prefix, active.versionId);
    const maxPos = entries.length > 0
      ? Math.max(...entries.map(e => e.position))
      : 0;
    const position = maxPos + 1;

    // 4. active 버전 capacity 체크
    if (position > active.capacity) {
      throw new ValidationError(
        `Capacity exhausted for "${prefix}/${active.versionId}": ` +
        `position ${position} exceeds capacity ${active.capacity}`,
      );
    }

    // 5. 모든 writable 버전 조회 (draft, released, active)
    const allVersions = await this._versions.getVersions(prefix);
    const writable = allVersions.filter(
      v => v.status === "draft" || v.status === "released" || v.status === "active",
    );

    const added: string[] = [];
    const skipped: Array<{ versionId: string; reason: string }> = [];
    const now = new Date().toISOString();
    let activeInserted = false;

    for (const ver of writable) {
      const isActive = ver.versionId === active.versionId;

      // capacity 체크
      if (position > ver.capacity) {
        skipped.push({
          versionId: ver.versionId,
          reason: `capacity ${ver.capacity} < position ${position}`,
        });
        continue;
      }

      // 해당 버전에 같은 value가 이미 있으면 skip
      const dupPos = await this._cache.getByValue(prefix, ver.versionId, value);
      if (dupPos !== null) {
        skipped.push({ versionId: ver.versionId, reason: "duplicate" });
        continue;
      }

      // 해당 position에 다른 값이 이미 있으면 skip
      const atPos = await this._cache.getByPosition(prefix, ver.versionId, position);
      if (atPos !== null) {
        skipped.push({
          versionId: ver.versionId,
          reason: `position ${position} occupied by "${atPos}"`,
        });
        continue;
      }

      // 삽입 — active는 에러 전파, non-active는 best-effort
      const record = { prefix, versionId: ver.versionId, position, value, createdAt: now };
      if (isActive) {
        await this._store.insertEntry(record);
        this._cache.append(prefix, ver.versionId, record);
        added.push(ver.versionId);
        activeInserted = true;
      } else {
        try {
          await this._store.insertEntry(record);
          this._cache.append(prefix, ver.versionId, record);
          added.push(ver.versionId);
        } catch (err) {
          skipped.push({
            versionId: ver.versionId,
            reason: `store error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    // ── 품질 게이트: 사후 불변식 검증 ──────────────────────────
    // active 버전은 반드시 삽입되어야 함
    if (!activeInserted) {
      throw new ValidationError(
        `Quality gate: active version "${active.versionId}" was not inserted for prefix "${prefix}"`,
      );
    }
    // added + skipped = 모든 writable 버전 (누락 없음)
    const accounted = added.length + skipped.length;
    if (accounted !== writable.length) {
      throw new ValidationError(
        `Quality gate: version accounting mismatch — ` +
        `writable=${writable.length}, added=${added.length}, skipped=${skipped.length}`,
      );
    }

    return { position, added, skipped };
  }
}
