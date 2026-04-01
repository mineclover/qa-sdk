/**
 * user-permission-engine.ts — 최종 권한 결정 Facade.
 *
 * 전체 파이프라인:
 *   Role 계보 (RoleRegistry)
 *     ↓ Domain Role 배정 확장 (OrgRoleRegistry)
 *     ↓ 역할 mask OR 합산 (RoleResolver)
 *     ↓ 유저 override AND NOT (UserOverrideStore)
 *     ↓ 최종 permission mask
 *
 * 외부에서 권한 체크의 단일 진입점.
 * RoleResolver / UserOverrideStore를 직접 쓰지 말고 이 클래스를 사용한다.
 */

import { setBit, hasBit } from "weighted-index";
import { RoleResolver, type ResolutionContext, type ExplainEntry } from "./role-resolver.js";
import { UserOverrideStore } from "./user-override.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** 최종 mask + 메타데이터. */
export interface FinalMaskResult {
  /** role mask & ~deny_mask. */
  mask: Uint8Array;
  /** mask 인덱스에 대응하는 feature ID 목록 (정렬). */
  featureIds: string[];
  /** role 단계에서 부여된 features (override 적용 전). */
  roleGrantedFeatures: string[];
  /** 이 유저에게 비활성화된 features. */
  deniedFeatures: string[];
}

/** 권한 거부 이유. */
export type DenialReason =
  | { kind: "not-assigned" }     // 어떤 role도 이 feature를 부여하지 않음
  | { kind: "user-override" };   // role에서 부여됐지만 유저 override로 비활성화됨

/** 권한 감사 결과. */
export interface AuditResult {
  feature: string;
  domain: string;
  userId: string;
  /** 최종 권한 보유 여부 (override 적용 후). */
  granted: boolean;
  /**
   * 권한을 부여한 배정 목록 (role 단계).
   * granted=false여도 role에서는 부여됐을 수 있음 (user-override로 차단된 경우).
   */
  sources: GrantSource[];
  /**
   * 거부 이유. granted=true면 null.
   * granted=false + sources 있음 → user-override.
   * granted=false + sources 없음 → not-assigned.
   */
  denialReason: DenialReason | null;
}

export interface GrantSource {
  source: "direct" | "org-role";
  /** org-role 출처일 때 org role ID. */
  orgRoleId?: string;
  /** 실제 domain role ID. */
  domainRole: string;
  /** 상속 경로 (루트 → 현재 role). */
  inheritancePath: string[];
}

// ── UserPermissionEngine ─────────────────────────────────────────────────────

export class UserPermissionEngine {
  constructor(
    private readonly resolver: RoleResolver,
    private readonly overrides: UserOverrideStore,
  ) {}

  /**
   * 최종 permission mask를 반환한다.
   *
   * role mask(OR 합산) → AND NOT override deny mask → final mask.
   */
  resolveFinalMask(
    userId: string,
    ctx: ResolutionContext,
    domain: string,
  ): FinalMaskResult {
    const { mask: roleMask, featureIds } = this.resolver.resolveDomainMask(ctx, domain);

    if (featureIds.length === 0) {
      return { mask: new Uint8Array(0), featureIds: [], roleGrantedFeatures: [], deniedFeatures: [] };
    }

    const denied = this.overrides.getDeniedFeatures(userId, domain);

    // deny mask 구성 (featureIds 인덱스 기반)
    const denyMask = new Uint8Array(roleMask.length);
    const deniedFeatures: string[] = [];
    for (let i = 0; i < featureIds.length; i++) {
      if (denied.has(featureIds[i])) {
        setBit(denyMask, i);
        deniedFeatures.push(featureIds[i]);
      }
    }

    // final = roleMask & ~denyMask
    const finalMask = new Uint8Array(roleMask.length);
    for (let i = 0; i < roleMask.length; i++) {
      finalMask[i] = roleMask[i] & ~denyMask[i];
    }

    // role 단계에서 부여된 feature 목록 (override 전)
    const roleGrantedFeatures: string[] = [];
    for (let i = 0; i < featureIds.length; i++) {
      if (hasBit(roleMask, i)) roleGrantedFeatures.push(featureIds[i]);
    }

    return { mask: finalMask, featureIds, roleGrantedFeatures, deniedFeatures };
  }

  /**
   * 특정 feature 권한 여부를 체크한다. O(1) 비트 체크.
   *
   * 동일 도메인에서 여러 feature를 체크할 때는
   * resolveFinalMask()로 mask를 한 번만 받아 hasBit()로 직접 체크할 것.
   */
  check(
    userId: string,
    ctx: ResolutionContext,
    domain: string,
    feature: string,
  ): boolean {
    const { mask, featureIds } = this.resolveFinalMask(userId, ctx, domain);
    const idx = featureIds.indexOf(feature);
    if (idx === -1) return false;
    return hasBit(mask, idx);
  }

  /**
   * 특정 feature 권한의 전체 감사 결과를 반환한다.
   *
   * - 권한이 있는 경우: 어느 role 배정에서 왔는지, 상속 경로
   * - 권한이 없는 경우: not-assigned인지 user-override로 차단됐는지
   */
  audit(
    userId: string,
    ctx: ResolutionContext,
    domain: string,
    feature: string,
  ): AuditResult {
    const { mask, featureIds, deniedFeatures } = this.resolveFinalMask(userId, ctx, domain);

    const idx = featureIds.indexOf(feature);
    const finalGranted = idx !== -1 && hasBit(mask, idx);

    // role 단계 출처 조회
    const explainEntries: ExplainEntry[] = this.resolver.explain(ctx, domain, feature);
    const roleGranted = explainEntries.length > 0;
    const userDenied = deniedFeatures.includes(feature);

    const sources: GrantSource[] = explainEntries.map(e => ({
      source: e.grantedBy.source,
      orgRoleId: e.grantedBy.source === "org-role" ? ctx.orgRoleId : undefined,
      domainRole: e.grantedBy.role,
      inheritancePath: e.grantedBy.inheritancePath,
    }));

    let denialReason: DenialReason | null = null;
    if (!finalGranted) {
      if (roleGranted && userDenied) {
        denialReason = { kind: "user-override" };
      } else {
        denialReason = { kind: "not-assigned" };
      }
    }

    return {
      feature,
      domain,
      userId,
      granted: finalGranted,
      sources,
      denialReason,
    };
  }

  /**
   * 유저가 접근 가능한 모든 도메인을 반환한다.
   * (role 배정이 있거나 override가 있는 도메인 포함)
   */
  accessibleDomains(userId: string, ctx: ResolutionContext): string[] {
    const domains = new Set(this.resolver.accessibleDomains(ctx));
    for (const d of this.overrides.domainsWithOverride(userId)) domains.add(d);
    return [...domains];
  }

  /**
   * 유저의 도메인별 전체 권한 현황 요약.
   * 각 domain에 대해 granted/denied feature 목록을 반환한다.
   */
  summarize(
    userId: string,
    ctx: ResolutionContext,
  ): Map<string, { granted: string[]; denied: string[] }> {
    const result = new Map<string, { granted: string[]; denied: string[] }>();
    for (const domain of this.accessibleDomains(userId, ctx)) {
      const { mask, featureIds, deniedFeatures } = this.resolveFinalMask(userId, ctx, domain);
      const granted: string[] = [];
      for (let i = 0; i < featureIds.length; i++) {
        if (hasBit(mask, i)) granted.push(featureIds[i]);
      }
      result.set(domain, { granted, denied: deniedFeatures });
    }
    return result;
  }
}
