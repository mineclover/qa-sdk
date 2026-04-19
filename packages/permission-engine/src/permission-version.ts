// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * permission-version.ts — 유저별 권한 버전 카운터.
 *
 * 권한 변경 시마다 버전을 bump하고, 발급된 JWT에 임베드한다.
 * 미들웨어는 token.perms_v vs store.getVersion()을 비교해
 * 불일치 시 401을 반환하여 토큰 재발급을 강제한다.
 *
 * PermissionVersionStore는 인터페이스만 정의한다.
 * 구현은 소비자가 주입:
 *   - InMemoryPermissionVersionStore  (테스트 / 단일 인스턴스)
 *   - DrizzlePermissionVersionStore   (SQLite/D1, 별도 구현)
 *   - RedisPermissionVersionStore     (분산 환경, 별도 구현)
 *
 * Drizzle 스키마 참고:
 *   permission_versions (userId TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, changed_at INTEGER NOT NULL)
 */

// ── Interface ─────────────────────────────────────────────────────────────────

export interface PermissionVersionStore {
  /** 유저의 현재 버전을 반환한다. 미등록 유저 = 0. */
  getVersion(userId: string): Promise<number>;

  /**
   * 유저의 버전을 1 증가시키고 새 버전을 반환한다.
   * 미등록 유저는 1로 초기화한다.
   */
  bumpVersion(userId: string): Promise<number>;

  /** 여러 유저의 버전을 한 번에 조회한다. 캐시 레이어 구현에 유용. */
  batchGetVersions(userIds: readonly string[]): Promise<Map<string, number>>;
}

// ── InMemory 구현 ─────────────────────────────────────────────────────────────

export class InMemoryPermissionVersionStore implements PermissionVersionStore {
  private readonly _versions = new Map<string, number>();

  async getVersion(userId: string): Promise<number> {
    return this._versions.get(userId) ?? 0;
  }

  async bumpVersion(userId: string): Promise<number> {
    const next = (this._versions.get(userId) ?? 0) + 1;
    this._versions.set(userId, next);
    return next;
  }

  async batchGetVersions(userIds: readonly string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const id of userIds) {
      result.set(id, this._versions.get(id) ?? 0);
    }
    return result;
  }

  /** 테스트용: 내부 상태 초기화. */
  clear(): void {
    this._versions.clear();
  }

  /** 테스트용: 특정 유저 버전을 직접 설정. */
  set(userId: string, version: number): void {
    this._versions.set(userId, version);
  }
}
