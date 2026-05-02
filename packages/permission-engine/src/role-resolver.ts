// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * role-resolver.ts — 사용자 권한 Resolution.
 *
 * 사용자의 직접 배정(direct) + Org Role 확장을 합산하여
 * 도메인별 flat 1D feature 마스크를 생성한다.
 *
 * 흐름:
 *   ResolutionContext (직접 배정 + org role)
 *     → collectDomainRoles(domain) → Set<roleId>
 *     → 각 role의 roleMask() OR 합산
 *     → Uint8Array (featureIds 인덱스 기반)
 *
 * 최종 check()는 O(1) hasBit.
 * resolveDomainMask()는 O(roles × features) — 한 번 계산 후 호출자가 캐시 권장.
 */

import { maskOr, hasBit } from "weighted-index";
import { RoleRegistry } from "./role-registry.js";
import { OrgRoleRegistry } from "./org-role-registry.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DirectAssignment {
  domain: string;
  role: string;
}

/** 사용자 Role 배정 컨텍스트. */
export interface ResolutionContext {
  /** 직접 배정된 Domain Role 목록. */
  directAssignments: readonly DirectAssignment[];
  /**
   * Org Role ID. 없으면 org role 미배정.
   * Org Role이 부여하는 domain role들이 directAssignments와 OR 합산된다.
   */
  orgRoleId?: string;
}

/** resolveDomainMask 반환값. */
export interface DomainMaskResult {
  /** 1D feature 마스크. featureIds 인덱스 기준. */
  mask: Uint8Array;
  /** 마스크 인덱스에 대응하는 feature ID 목록. */
  featureIds: string[];
}

/** explain() 결과 항목 — 어떤 배정이 권한을 부여했는지 추적. */
export interface ExplainEntry {
  feature: string;
  grantedBy: {
    source: "direct" | "org-role";
    domain: string;
    role: string;
    /** 상속 경로 (조상 → ... → 직접 보유 role). */
    inheritancePath: string[];
  };
}

// ── RoleResolver ─────────────────────────────────────────────────────────────

export class RoleResolver {
  constructor(
    private readonly roleRegistry: RoleRegistry,
    private readonly orgRoleRegistry: OrgRoleRegistry,
  ) {}

  /**
   * 특정 도메인에 대한 사용자의 1D feature 마스크를 반환한다.
   *
   * - 직접 배정 + org role 확장을 합산 (OR)
   * - 사용자가 해당 도메인에 어떤 role도 없으면 빈 mask 반환
   */
  resolveDomainMask(
    ctx: ResolutionContext,
    domain: string,
  ): DomainMaskResult {
    const roles = this._collectDomainRoles(ctx, domain);
    if (roles.size === 0) {
      return { mask: new Uint8Array(0), featureIds: [] };
    }

    const featureIds = this.roleRegistry.domainFeatureIds(domain);
    const maskLen = Math.ceil(featureIds.length / 8);
    let resultMask = new Uint8Array(maskLen);

    for (const roleId of roles) {
      // 등록되지 않은 role은 skip (org role이 unknown domain role을 가리킬 수 있음)
      try {
        const roleMask = this.roleRegistry.roleMask(domain, roleId);
        resultMask = new Uint8Array(maskOr(resultMask, roleMask));
      } catch {
        // unknown role in domain — 무시
      }
    }

    return { mask: resultMask, featureIds };
  }

  /**
   * 특정 도메인 + feature에 대한 권한 여부. O(1) 비트 체크.
   *
   * 주의: 매 호출마다 mask를 재계산한다.
   *       동일 도메인에서 여러 feature를 체크할 때는
   *       resolveDomainMask()로 mask를 한 번만 받아서 hasBit()로 직접 체크할 것.
   */
  check(
    ctx: ResolutionContext,
    domain: string,
    feature: string,
  ): boolean {
    const { mask, featureIds } = this.resolveDomainMask(ctx, domain);
    const idx = featureIds.indexOf(feature);
    if (idx === -1) return false;
    return hasBit(mask, idx);
  }

  /**
   * 사용자가 권한을 보유하는 모든 도메인 목록.
   * (role 배정이 있는 도메인 — feature가 0개인 경우도 포함될 수 있음)
   */
  accessibleDomains(ctx: ResolutionContext): string[] {
    const domains = new Set<string>();
    for (const { domain } of ctx.directAssignments) domains.add(domain);
    if (ctx.orgRoleId) {
      for (const domain of this.orgRoleRegistry.resolve(ctx.orgRoleId).keys()) {
        domains.add(domain);
      }
    }
    return [...domains];
  }

  /**
   * 특정 feature 권한이 어떤 배정에서 부여되었는지 추적한다 (감사용).
   * 동일 권한에 여러 경로가 있을 수 있다.
   */
  explain(
    ctx: ResolutionContext,
    domain: string,
    feature: string,
  ): ExplainEntry[] {
    const result: ExplainEntry[] = [];

    // 직접 배정
    for (const { domain: d, role } of ctx.directAssignments) {
      if (d !== domain) continue;
      try {
        const feats = this.roleRegistry.resolvedFeatures(domain, role);
        if (feats.has(feature)) {
          result.push({
            feature,
            grantedBy: {
              source: "direct",
              domain,
              role,
              inheritancePath: this._inheritancePath(domain, role, feature),
            },
          });
        }
      } catch { /* unknown role */ }
    }

    // Org Role 확장
    if (ctx.orgRoleId) {
      const orgRoles = this.orgRoleRegistry.resolveForDomain(ctx.orgRoleId, domain);
      const directRoles = new Set(
        ctx.directAssignments.filter(a => a.domain === domain).map(a => a.role),
      );
      for (const role of orgRoles) {
        if (directRoles.has(role)) continue; // 이미 direct에서 보고됨
        try {
          const feats = this.roleRegistry.resolvedFeatures(domain, role);
          if (feats.has(feature)) {
            result.push({
              feature,
              grantedBy: {
                source: "org-role",
                domain,
                role,
                inheritancePath: this._inheritancePath(domain, role, feature),
              },
            });
          }
        } catch { /* unknown role */ }
      }
    }

    return result;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** 도메인에 적용되는 모든 role ID 수집 (direct + org-role 확장). */
  private _collectDomainRoles(
    ctx: ResolutionContext,
    domain: string,
  ): Set<string> {
    const roles = new Set<string>();
    for (const { domain: d, role } of ctx.directAssignments) {
      if (d === domain) roles.add(role);
    }
    if (ctx.orgRoleId) {
      for (const role of this.orgRoleRegistry.resolveForDomain(ctx.orgRoleId, domain)) {
        roles.add(role);
      }
    }
    return roles;
  }

  /**
   * 특정 feature를 부여하는 상속 경로를 반환한다.
   * 예: ["viewer", "author"] — viewer가 먼저 feature를 정의, author가 상속
   */
  private _inheritancePath(
    domain: string,
    roleId: string,
    feature: string,
  ): string[] {
    const path: string[] = [];
    this._tracePath(domain, roleId, feature, path);
    return path;
  }

  private _tracePath(
    domain: string,
    roleId: string,
    feature: string,
    path: string[],
  ): boolean {
    let found = false;
    // 부모 경로 먼저 탐색 (상속 원점 찾기)
    try {
      const def = this._getRoleDef(domain, roleId);
      for (const parentId of def.parents) {
        if (this._tracePath(domain, parentId, feature, path)) {
          found = true;
          break;
        }
      }
      // 자신의 ownFeatures에 있으면 경로에 추가
      if (!found && def.ownFeatures.includes(feature)) {
        found = true;
      }
    } catch { /* unknown role */ }

    if (found) path.push(roleId);
    return found;
  }

  private _getRoleDef(domain: string, roleId: string) {
    return this.roleRegistry.getDef(domain, roleId);
  }
}
