// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * scoped-engine.ts — 컨텍스트 스코프 권한 엔진.
 *
 * env/region 같은 외부 차원을 키로 사용하여
 * 스코프별 독립 PermissionSet을 관리한다.
 *
 * 사용 예:
 *   const engine = new ScopedEngine(features, roles);
 *   engine.scope("prod:asia").grant("payment_history", "admin");
 *   engine.scope("prod:asia").has("payment_history", "admin"); // true
 *   engine.scope("dev:usa").has("payment_history", "admin");   // false
 */

import { PermissionSet, type DimDef } from "./permission-set.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScopedEngineSnapshot {
  features: readonly string[];
  roles: readonly string[];
  scopes: Record<string, string>; // scopeKey → base64 mask
}

// ── ScopedEngine ─────────────────────────────────────────────────────────────

export class ScopedEngine {
  private readonly _features: DimDef;
  private readonly _roles: DimDef;
  private readonly _scopes = new Map<string, PermissionSet>();

  constructor(features: DimDef, roles: DimDef) {
    this._features = features;
    this._roles = roles;
  }

  /** 스코프 키로 PermissionSet 획득. 없으면 새로 생성 (전체 deny). */
  scope(key: string): PermissionSet {
    let ps = this._scopes.get(key);
    if (!ps) {
      ps = new PermissionSet({ features: this._features, roles: this._roles });
      this._scopes.set(key, ps);
    }
    return ps;
  }

  /** 스코프 존재 여부. */
  hasScope(key: string): boolean {
    return this._scopes.has(key);
  }

  /** 등록된 모든 스코프 키. */
  scopeKeys(): string[] {
    return [...this._scopes.keys()];
  }

  /** 스코프 제거. */
  deleteScope(key: string): boolean {
    return this._scopes.delete(key);
  }

  /**
   * 여러 스코프의 합집합.
   * "이 역할이 어느 환경에서든 이 기능에 접근 가능한가?"
   */
  unionScopes(keys: readonly string[]): PermissionSet {
    let result: PermissionSet | null = null;
    for (const key of keys) {
      const ps = this._scopes.get(key);
      if (!ps) continue;
      result = result ? result.union(ps) : ps.clone();
    }
    return result ?? new PermissionSet({ features: this._features, roles: this._roles });
  }

  /**
   * 여러 스코프의 교집합.
   * "이 역할이 모든 지정 환경에서 이 기능에 접근 가능한가?"
   */
  intersectScopes(keys: readonly string[]): PermissionSet {
    let result: PermissionSet | null = null;
    for (const key of keys) {
      const ps = this._scopes.get(key);
      if (!ps) {
        // 존재하지 않는 스코프 = 전체 deny → 교집합은 전체 deny
        return new PermissionSet({ features: this._features, roles: this._roles });
      }
      result = result ? result.intersect(ps) : ps.clone();
    }
    return result ?? new PermissionSet({ features: this._features, roles: this._roles });
  }

  // ── 직렬화 ─────────────────────────────────────────────────────────────────

  toSnapshot(): ScopedEngineSnapshot {
    const scopes: Record<string, string> = {};
    for (const [key, ps] of this._scopes) {
      scopes[key] = ps.toSnapshot().mask;
    }
    return {
      features: this._features.ids,
      roles: this._roles.ids,
      scopes,
    };
  }

  static fromSnapshot(snap: ScopedEngineSnapshot): ScopedEngine {
    const features: DimDef = { name: "features", ids: snap.features };
    const roles: DimDef = { name: "roles", ids: snap.roles };
    const engine = new ScopedEngine(features, roles);
    for (const [key, maskB64] of Object.entries(snap.scopes)) {
      const ps = PermissionSet.fromSnapshot({
        features: snap.features,
        roles: snap.roles,
        mask: maskB64,
      });
      engine._scopes.set(key, ps);
    }
    return engine;
  }
}
