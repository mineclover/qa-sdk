// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * user-override.ts — 유저 단위 권한 비활성화 레이어.
 *
 * Role 기반 권한 부여(RoleResolver)와 독립적으로,
 * 특정 유저의 특정 feature를 명시적으로 비활성화한다.
 *
 * 의미론:
 *  - 오직 DENY만 가능 (role에 없는 권한을 추가로 부여하지 않음)
 *  - final = role_mask & ~deny_mask
 *  - 역할 기반 권한보다 항상 우선 (user override가 override)
 *
 * 설계 원칙:
 *  - UserOverrideStore는 pure store — 비트 계산 없음
 *  - 비트 적용은 UserPermissionEngine이 담당
 *  - 도메인별로 독립적으로 관리
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** 특정 유저의 특정 도메인 override 스냅샷. */
export interface UserOverrideSnapshot {
  userId: string;
  /** domain → 비활성화된 feature ID 목록 */
  overrides: Record<string, string[]>;
}

// ── UserOverrideStore ─────────────────────────────────────────────────────────

export class UserOverrideStore {
  /** userId → domain → Set<featureId> */
  private readonly _store = new Map<string, Map<string, Set<string>>>();

  /**
   * 특정 유저의 특정 도메인에서 feature를 비활성화한다.
   * 이미 비활성화된 feature를 다시 추가해도 멱등하다.
   */
  deny(userId: string, domain: string, features: string | readonly string[]): void {
    const domainMap = this._getOrCreateDomainMap(userId);
    let featureSet = domainMap.get(domain);
    if (!featureSet) {
      featureSet = new Set();
      domainMap.set(domain, featureSet);
    }
    const list = typeof features === 'string' ? [features] : features;
    for (const f of list) featureSet.add(f);
  }

  /**
   * 특정 유저의 특정 도메인에서 비활성화를 해제한다.
   */
  undeny(userId: string, domain: string, features: string | readonly string[]): void {
    const featureSet = this._store.get(userId)?.get(domain);
    if (!featureSet) return;
    const list = typeof features === 'string' ? [features] : features;
    for (const f of list) featureSet.delete(f);
  }

  /**
   * 특정 유저의 특정 도메인에서 비활성화된 feature 집합을 반환한다.
   * 없으면 빈 Set.
   */
  getDeniedFeatures(userId: string, domain: string): ReadonlySet<string> {
    return this._store.get(userId)?.get(domain) ?? new Set();
  }

  /**
   * 특정 유저의 모든 override를 제거한다.
   * domain을 지정하면 해당 도메인만 제거.
   */
  clearUser(userId: string, domain?: string): void {
    if (domain) {
      this._store.get(userId)?.delete(domain);
    } else {
      this._store.delete(userId);
    }
  }

  /**
   * 특정 유저가 override를 가지는 도메인 목록.
   */
  domainsWithOverride(userId: string): string[] {
    const domainMap = this._store.get(userId);
    if (!domainMap) return [];
    return [...domainMap.entries()].filter(([, set]) => set.size > 0).map(([domain]) => domain);
  }

  /**
   * 특정 feature가 이 유저에게 비활성화되어 있는지.
   */
  isDenied(userId: string, domain: string, feature: string): boolean {
    return this._store.get(userId)?.get(domain)?.has(feature) ?? false;
  }

  // ── 직렬화 ─────────────────────────────────────────────────────────────────

  toSnapshot(userId: string): UserOverrideSnapshot {
    const domainMap = this._store.get(userId);
    const overrides: Record<string, string[]> = {};
    if (domainMap) {
      for (const [domain, features] of domainMap) {
        if (features.size > 0) overrides[domain] = [...features];
      }
    }
    return { userId, overrides };
  }

  fromSnapshot(snap: UserOverrideSnapshot): void {
    for (const [domain, features] of Object.entries(snap.overrides)) {
      this.deny(snap.userId, domain, features);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _getOrCreateDomainMap(userId: string): Map<string, Set<string>> {
    let m = this._store.get(userId);
    if (!m) {
      m = new Map();
      this._store.set(userId, m);
    }
    return m;
  }
}
