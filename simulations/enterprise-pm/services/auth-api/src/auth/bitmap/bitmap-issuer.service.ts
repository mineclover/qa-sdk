// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { issueBitmap, type VersionedBitmap } from "permission-engine";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import { computeUserBits } from "../shared/compute-user-bits.js";
import type { Role } from "../shared/types.js";

export interface BitmapIssuerConfig {
  secret: Uint8Array;
  ttlMs: number;
  issuer: string;
  /** prefix version. design.md §3 — 초기는 'v1', latestPrefixVersion 동적 조회는 향후. */
  version?: string;
}

export const BITMAP_ISSUER_CONFIG = "BITMAP_ISSUER_CONFIG";

@Injectable()
export class BitmapIssuerService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Inject(BITMAP_ISSUER_CONFIG) private readonly cfg: BitmapIssuerConfig,
  ) {}

  /**
   * 주어진 userId에 대해 sim.bitmap prefix VersionedBitmap을 발급.
   *
   * 알고리즘:
   *   1. user 존재 확인. 없으면 null.
   *   2. user의 모든 RoleAssignment 조회.
   *   3. assignments에 등장하는 roleId 셋 → roles map 구성.
   *   4. computeUserBits로 mask 계산.
   *   5. issueBitmap으로 HMAC 서명된 VersionedBitmap 반환.
   *
   * scope 필터는 본 plan에서는 모든 assignment를 그대로 union (단순화).
   * Plan 12a가 scope 매칭 로직(department/project)을 추가.
   */
  async issueForUser(userId: string): Promise<VersionedBitmap | null> {
    const user = await this.repo.findUser(userId);
    if (!user) return null;

    const assignments = await this.repo.listAssignmentsForUser(userId);
    const roleIds = new Set(assignments.map((a) => a.roleId));
    const roles = new Map<string, Role>();
    for (const rid of roleIds) {
      const role = await this.repo.findRole(rid);
      if (role) roles.set(rid, role);
    }

    const mask = computeUserBits({ assignments, roles });

    return issueBitmap({
      prefix: "sim.bitmap",
      v: this.cfg.version ?? "v1",
      mask,
      issuer: this.cfg.issuer,
      secret: this.cfg.secret,
      ttlMs: this.cfg.ttlMs,
    });
  }
}
