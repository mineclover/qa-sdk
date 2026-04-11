/**
 * permission-middleware.ts — 요청 시 권한 판정.
 *
 * 두 가지 검사를 순서대로 수행한다:
 *
 * 1. 버전 체크 (소프트 만료):
 *    token.perms_v < store.getVersion(userId) → 401 VERSION_MISMATCH
 *    권한이 변경됐으므로 토큰 재발급 필요.
 *
 * 2. 스키마 체크 (feature 정의 변경):
 *    token.perms_schema !== computeSchemaHash(roleRegistry) → 401 SCHEMA_MISMATCH
 *    feature 인덱스 순서가 바뀌었으므로 구 bitmask는 무효.
 *
 * 3. 권한 체크 (DB 조회 없음):
 *    hasBit(base64Decode(token.perms[domain]), featureIndex) → O(1)
 */

import { hasBit } from "weighted-index";
import { type PermissionVersionStore } from "./permission-version.js";
import { type RoleRegistry } from "./role-registry.js";
import { type PermissionClaims, computeSchemaHash, base64ToUint8 } from "./token-enrichment.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type MiddlewareErrorKind =
  | "VERSION_MISMATCH"   // 권한 변경됨 → 토큰 재발급 필요
  | "SCHEMA_MISMATCH"    // feature 정의 변경됨 → 재발급 필요
  | "NO_DOMAIN_CLAIM"    // 토큰에 해당 도메인 없음
  | "FEATURE_NOT_FOUND"  // 알 수 없는 feature ID
  | "PERMISSION_DENIED"; // claim은 있으나 해당 feature bit가 꺼져 있음

export interface MiddlewareError {
  kind: MiddlewareErrorKind;
  message: string;
}

export type CheckResult =
  | { ok: true }
  | { ok: false; error: MiddlewareError };

// ── PermissionMiddleware ──────────────────────────────────────────────────────

export class PermissionMiddleware {
  constructor(
    private readonly roleRegistry: RoleRegistry,
    private readonly versionStore: PermissionVersionStore,
  ) {}

  /**
   * 토큰 claims에서 직접 권한을 체크한다. DB 조회 없음.
   *
   * 버전 / 스키마 불일치 시 에러를 반환한다.
   * 호출자는 에러 종류에 따라 401을 반환하고 클라이언트가 토큰을 재발급받게 한다.
   */
  async check(
    claims: PermissionClaims & { sub: string },
    domain: string,
    feature: string,
  ): Promise<CheckResult> {
    // 1. 스키마 체크 (동기, DB 없음)
    const schemaErr = this._checkSchema(claims);
    if (schemaErr) return { ok: false, error: schemaErr };

    // 2. 버전 체크 (비동기, DB 조회 1회)
    const versionErr = await this._checkVersion(claims);
    if (versionErr) return { ok: false, error: versionErr };

    // 3. 권한 체크 (동기, DB 없음)
    return this._checkPermission(claims, domain, feature);
  }

  /**
   * 버전 / 스키마 유효성만 검사한다 (권한 체크 없음).
   * 미들웨어 진입 시 1회 수행하고 이후 checkFromClaims()로 체크.
   */
  async validate(
    claims: PermissionClaims & { sub: string },
  ): Promise<MiddlewareError | null> {
    return this._checkSchema(claims) ?? await this._checkVersion(claims);
  }

  /**
   * validate() 통과 후 권한을 반복 체크할 때 사용. O(1), DB 없음.
   * validate()를 먼저 호출했음을 전제한다.
   */
  checkFromClaims(
    claims: PermissionClaims,
    domain: string,
    feature: string,
  ): CheckResult {
    return this._checkPermission(claims, domain, feature);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _checkSchema(claims: PermissionClaims): MiddlewareError | null {
    // 항상 현재 registry 상태로 계산 — registry 변경 즉시 감지
    const currentHash = computeSchemaHash(this.roleRegistry);
    if (claims.perms_schema !== currentHash) {
      return {
        kind: "SCHEMA_MISMATCH",
        message: `Permission schema changed. Token schema: ${claims.perms_schema}, current: ${currentHash}. Please re-authenticate.`,
      };
    }
    return null;
  }

  private async _checkVersion(
    claims: PermissionClaims & { sub: string },
  ): Promise<MiddlewareError | null> {
    const currentVersion = await this.versionStore.getVersion(claims.sub);
    if (claims.perms_v < currentVersion) {
      return {
        kind: "VERSION_MISMATCH",
        message: `Permission version mismatch for user ${claims.sub}. Token: ${claims.perms_v}, current: ${currentVersion}. Please refresh token.`,
      };
    }
    return null;
  }

  private _checkPermission(
    claims: PermissionClaims,
    domain: string,
    feature: string,
  ): CheckResult {
    const b64 = claims.perms[domain];
    if (!b64) {
      return { ok: false, error: { kind: "NO_DOMAIN_CLAIM", message: `No permission claim for domain "${domain}"` } };
    }

    const featureIds = this.roleRegistry.domainFeatureIds(domain);
    const idx = featureIds.indexOf(feature);
    if (idx === -1) {
      return { ok: false, error: { kind: "FEATURE_NOT_FOUND", message: `Unknown feature "${feature}" in domain "${domain}"` } };
    }

    const mask = base64ToUint8(b64);
    return hasBit(mask, idx) ? { ok: true } : {
      ok: false,
      error: { kind: "PERMISSION_DENIED", message: `Permission denied: "${feature}" in domain "${domain}"` },
    };
  }
}
