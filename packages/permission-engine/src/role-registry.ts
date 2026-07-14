// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * role-registry.ts — Domain Role 계보 정의 및 feature 집합 사전 계산.
 *
 * Domain Role은 특정 도메인 내 권한의 기본 단위다.
 * 부모 role의 feature 집합을 누적 OR로 상속하므로
 * register() 시점에 상속 체인을 완전히 flatten한다.
 *
 * 설계 원칙:
 *  - 상속 의미론: 누적 OR (deny-wins 아님 — TernaryMask와 다름)
 *  - 사전 계산: 쿼리 시점에 상속 체인 순회 없음, 결과 캐시
 *  - 사이클 감지: resolvedFeatures() 호출 시 즉시 오류
 *  - 불변성: register() 후 정의 변경 불가 — 캐시 항상 유효
 */

import { createMask, setBit, hasBit } from 'weighted-index';

import { PermissionSet, type DimDef } from './permission-set.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** Domain Role 정의. */
export interface DomainRoleDef {
  /** Role 식별자. 같은 domain 내 유일해야 함. */
  id: string;
  /** 이 Role이 속한 도메인. */
  domain: string;
  /**
   * 이 Role이 직접 보유하는 feature ID 목록.
   * 상속 feature 제외 — 순수 추가분만 선언한다.
   */
  ownFeatures: readonly string[];
  /**
   * 상속받는 부모 Role ID 목록 (같은 domain 내).
   * 누적 OR — 부모의 모든 feature를 포함한다.
   * 빈 배열 = 루트 role (상속 없음).
   * 분기 상속: 부모를 여러 개 지정하면 모두 합산.
   */
  parents: readonly string[];
  /**
   * 상속에서 제외할 Role ID 목록 (같은 domain 내).
   * 해당 role의 resolvedFeatures 전체를 deny set에 추가한다.
   * grant와 대칭: parents가 role 단위 부여, denyRoles가 role 단위 제거.
   */
  denyRoles?: readonly string[];
  /**
   * 상속에서 제외할 개별 feature ID 목록.
   * grant와 대칭: ownFeatures가 feature 단위 부여, denyFeatures가 feature 단위 제거.
   */
  denyFeatures?: readonly string[];
}

export interface RoleRegistryValidationError {
  domain: string;
  roleId: string;
  kind: 'cycle' | 'unknown-parent' | 'duplicate' | 'unknown-deny-role' | 'self-deny-role';
  message: string;
}

// ── Internal ─────────────────────────────────────────────────────────────────

interface RoleNode {
  def: DomainRoleDef;
  /** 사전 계산된 전체 feature 집합 (own + 모든 조상). null = 미계산. */
  resolved: Set<string> | null;
}

// ── RoleRegistry ─────────────────────────────────────────────────────────────

export class RoleRegistry {
  /** domain → (roleId → RoleNode) */
  private readonly _domains = new Map<string, Map<string, RoleNode>>();
  /** buildDomainPermissionSet 결과 캐시. domain → PermissionSet */
  private readonly _psCache = new Map<string, PermissionSet>();
  /** 도메인 전체 feature 목록 캐시 (정렬됨). domain → string[] */
  private readonly _featureCache = new Map<string, string[]>();

  /**
   * Domain Role을 등록한다.
   * 동일 domain 내 중복 id 불허.
   * 등록 순서는 무관하다 — 부모가 아직 없어도 등록 가능.
   */
  register(def: DomainRoleDef): void {
    let domainMap = this._domains.get(def.domain);
    if (!domainMap) {
      domainMap = new Map();
      this._domains.set(def.domain, domainMap);
    }
    if (domainMap.has(def.id)) {
      throw new RangeError(`Duplicate role "${def.id}" in domain "${def.domain}"`);
    }
    domainMap.set(def.id, { def, resolved: null });
    // 캐시 무효화
    this._psCache.delete(def.domain);
    this._featureCache.delete(def.domain);
  }

  /**
   * 특정 domain의 role이 보유하는 전체 feature 집합을 반환한다.
   * 상속 체인을 재귀 DFS로 flatten하여 OR 합산.
   * 결과는 캐시된다 (불변성 보장).
   */
  resolvedFeatures(domain: string, roleId: string): ReadonlySet<string> {
    const node = this._getNode(domain, roleId);
    if (!node.resolved) {
      node.resolved = this._resolveFeatures(domain, roleId, new Set());
    }
    return node.resolved;
  }

  /**
   * 도메인의 전체 feature 목록 (모든 role의 resolved features 합집합, 정렬).
   * buildDomainPermissionSet의 feature 차원 기준으로 사용한다.
   */
  domainFeatureIds(domain: string): string[] {
    const cached = this._featureCache.get(domain);
    if (cached) return cached;

    const domainMap = this._domains.get(domain);
    if (!domainMap) throw new RangeError(`Unknown domain: "${domain}"`);

    const all = new Set<string>();
    for (const roleId of domainMap.keys()) {
      for (const f of this.resolvedFeatures(domain, roleId)) all.add(f);
    }
    const sorted = [...all].toSorted();
    this._featureCache.set(domain, sorted);
    return sorted;
  }

  /**
   * 도메인의 모든 role과 feature를 포함하는 PermissionSet을 빌드한다.
   * 상속이 반영된 (materialized) 2D 행렬.
   * 결과는 캐시된다.
   */
  buildDomainPermissionSet(domain: string): PermissionSet {
    const cached = this._psCache.get(domain);
    if (cached) return cached;

    const domainMap = this._domains.get(domain);
    if (!domainMap) throw new RangeError(`Unknown domain: "${domain}"`);

    const featureIds = this.domainFeatureIds(domain);
    if (featureIds.length === 0) {
      throw new RangeError(`Domain "${domain}" has no features defined`);
    }

    const roleIds = [...domainMap.keys()];
    const features: DimDef = { name: `${domain}:features`, ids: featureIds };
    const roles: DimDef = { name: `${domain}:roles`, ids: roleIds };
    const ps = new PermissionSet({ features, roles });

    for (const roleId of roleIds) {
      for (const feat of this.resolvedFeatures(domain, roleId)) {
        ps.grant(feat, roleId);
      }
    }

    this._psCache.set(domain, ps);
    return ps;
  }

  /**
   * 특정 role에 대한 1D feature 마스크를 반환한다.
   * featureIds 순서는 domainFeatureIds(domain)와 동일.
   */
  roleMask(domain: string, roleId: string): Uint8Array {
    const featureIds = this.domainFeatureIds(domain);
    const resolved = this.resolvedFeatures(domain, roleId);
    const mask = createMask(featureIds.length);
    for (let i = 0; i < featureIds.length; i++) {
      if (resolved.has(featureIds[i])) setBit(mask, i);
    }
    return mask;
  }

  /** 특정 domain role의 원본 정의를 반환한다. */
  getDef(domain: string, roleId: string): DomainRoleDef {
    return this._getNode(domain, roleId).def;
  }

  /** 특정 domain의 등록된 role 목록. */
  rolesInDomain(domain: string): string[] {
    return [...(this._domains.get(domain)?.keys() ?? [])];
  }

  /** 등록된 모든 domain 목록. */
  domains(): string[] {
    return [...this._domains.keys()];
  }

  /**
   * 등록된 모든 role 정의를 검증한다.
   * - 알 수 없는 부모 참조
   * - 순환 상속
   */
  validate(): RoleRegistryValidationError[] {
    const errors: RoleRegistryValidationError[] = [];
    for (const [domain, domainMap] of this._domains) {
      for (const roleId of domainMap.keys()) {
        const node = domainMap.get(roleId)!;
        // 알 수 없는 부모
        for (const parentId of node.def.parents) {
          if (!domainMap.has(parentId)) {
            errors.push({
              domain,
              roleId,
              kind: 'unknown-parent',
              message: `Role "${roleId}" in domain "${domain}" references unknown parent "${parentId}"`,
            });
          }
        }
        // deny 검증
        for (const denyRoleId of node.def.denyRoles ?? []) {
          if (denyRoleId === roleId) {
            errors.push({
              domain,
              roleId,
              kind: 'self-deny-role',
              message: `Role "${roleId}" in domain "${domain}" denies itself`,
            });
          } else if (!domainMap.has(denyRoleId)) {
            errors.push({
              domain,
              roleId,
              kind: 'unknown-deny-role',
              message: `Role "${roleId}" in domain "${domain}" denies unknown role "${denyRoleId}"`,
            });
          }
        }
        // 순환 감지
        try {
          this._resolveFeatures(domain, roleId, new Set());
        } catch (e) {
          if (e instanceof RangeError && e.message.includes('Circular')) {
            errors.push({ domain, roleId, kind: 'cycle', message: e.message });
          }
        }
      }
    }
    return errors;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _getNode(domain: string, roleId: string): RoleNode {
    const node = this._domains.get(domain)?.get(roleId);
    if (!node) throw new RangeError(`Unknown role "${roleId}" in domain "${domain}"`);
    return node;
  }

  /** DFS로 상속 체인을 순회하며 feature 집합을 flatten한다. */
  private _resolveFeatures(domain: string, roleId: string, visiting: Set<string>): Set<string> {
    if (visiting.has(roleId)) {
      throw new RangeError(`Circular inheritance detected: role "${roleId}" in domain "${domain}"`);
    }

    const node = this._getNode(domain, roleId);
    if (node.resolved) return node.resolved;

    visiting.add(roleId);

    // 1. parents → OR 합산
    const result = new Set<string>(node.def.ownFeatures);
    for (const parentId of node.def.parents) {
      const parentNode = this._getNode(domain, parentId);
      const parentFeats =
        parentNode.resolved ?? this._resolveFeatures(domain, parentId, new Set(visiting));
      for (const f of parentFeats) result.add(f);
    }

    // 2. deny set 구성 (denyRoles + denyFeatures)
    const { denyRoles, denyFeatures } = node.def;
    if (denyRoles?.length || denyFeatures?.length) {
      const denySet = new Set<string>(denyFeatures ?? []);
      for (const denyRoleId of denyRoles ?? []) {
        const denyNode = this._getNode(domain, denyRoleId);
        const denyFeats =
          denyNode.resolved ?? this._resolveFeatures(domain, denyRoleId, new Set(visiting));
        for (const f of denyFeats) denySet.add(f);
      }
      // 3. grant - deny
      for (const f of denySet) result.delete(f);
    }

    visiting.delete(roleId);
    node.resolved = result;
    return result;
  }
}
