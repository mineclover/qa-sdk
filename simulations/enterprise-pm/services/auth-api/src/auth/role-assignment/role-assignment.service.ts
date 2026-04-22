// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { RoleAssignment, RoleAssignmentCreate } from "../shared/types.js";

@Injectable()
export class RoleAssignmentService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository) {}

  assign(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    return this.repo.assignRole(args);
  }
  revoke(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<void> {
    return this.repo.revokeRole(userId, roleId, scopeType, scopeId);
  }
  listForUser(userId: string): Promise<RoleAssignment[]> {
    return this.repo.listAssignmentsForUser(userId);
  }
}
