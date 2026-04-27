// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { issueBitmap } from "permission-engine";
import { BitmapIssueQuery } from "../../application/queries/bitmap-issue.query.js";
import type { BitmapIssueResult } from "../../domain/index.js";
import type { UserQueryPort } from "../../application/ports/user-query.port.js";
import type { RoleAssignmentQueryPort } from "../../application/ports/role-assignment-query.port.js";
import type { RoleQueryPort, RoleViewForBitmap } from "../../application/ports/role-query.port.js";
import { computeBitsFor } from "../computation/compute-bits.js";

export interface BitmapIssuerConfig {
  readonly secret: Uint8Array;
  readonly ttlMs: number;
  readonly issuer: string;
  /** prefix version. design.md §3 — 초기는 'v1'. */
  readonly version?: string;
}

/**
 * Read-model 기반 bitmap 발급 — User + RoleAssignment + Role read model 을
 * 합성하여 VersionedBitmap 을 반환한다.
 *
 * write 영속이 없으므로 transaction/outbox 미사용. cross-domain query port 만
 * 의존.
 */
export class IssuerBitmapReadModel extends BitmapIssueQuery {
  constructor(
    private readonly userQuery: UserQueryPort,
    private readonly roleAssignmentQuery: RoleAssignmentQueryPort,
    private readonly roleQuery: RoleQueryPort,
    private readonly config: BitmapIssuerConfig,
  ) {
    super();
  }

  async issueForUser(userId: string): Promise<BitmapIssueResult | null> {
    const user = await this.userQuery.findById(userId);
    if (!user) return null;

    const assignments = await this.roleAssignmentQuery.listForUser(userId);
    const roleIds = new Set(assignments.map((a) => a.roleId));
    const roles = new Map<string, RoleViewForBitmap>();
    for (const rid of roleIds) {
      const role = await this.roleQuery.findById(rid);
      if (role) roles.set(rid, role);
    }
    const mask = computeBitsFor(assignments, roles);

    const bm = issueBitmap({
      prefix: "sim.bitmap",
      v: this.config.version ?? "v1",
      mask,
      issuer: this.config.issuer,
      secret: this.config.secret,
      ttlMs: this.config.ttlMs,
    });

    return {
      prefix: bm.prefix,
      v: bm.v,
      mask: bm.mask,
      issuedAt: bm.issuedAt,
      expiresAt: bm.expiresAt,
      issuer: bm.issuer,
      signature: bm.signature,
    };
  }
}
