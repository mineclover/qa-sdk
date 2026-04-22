// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Inject, Injectable, Optional } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { RoleAssignment, RoleAssignmentCreate } from "../shared/types.js";
import { BitmapCacheService } from "@qa-sdk/sim-bitmap-cache";

@Injectable()
export class RoleAssignmentService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Optional() private readonly bitmapCache?: BitmapCacheService,
  ) {}

  async assign(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    const result = await this.repo.assignRole(args);
    // §5 (Invalidation): 권한 변경 → invalidation publish.
    if (this.bitmapCache?.publisher) {
      await this.bitmapCache.publisher.publishUserChange(
        args.userId,
        "permission_change",
      );
    }
    return result;
  }

  async revoke(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<void> {
    await this.repo.revokeRole(userId, roleId, scopeType, scopeId);
    if (this.bitmapCache?.publisher) {
      await this.bitmapCache.publisher.publishUserChange(
        userId,
        "permission_change",
      );
    }
  }

  listForUser(userId: string): Promise<RoleAssignment[]> {
    return this.repo.listAssignmentsForUser(userId);
  }
}
