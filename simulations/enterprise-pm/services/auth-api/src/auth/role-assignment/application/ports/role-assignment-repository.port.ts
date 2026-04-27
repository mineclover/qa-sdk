// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleAssignmentEntity } from "../../domain/index.js";
import type { RoleAssignmentTransactionScope } from "./role-assignment-transaction.port.js";

export abstract class RoleAssignmentRepositoryPort {
  abstract save(entity: RoleAssignmentEntity, scope: RoleAssignmentTransactionScope): Promise<void>;
  abstract findOne(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<RoleAssignmentEntity | null>;
  abstract listForUser(userId: string): Promise<RoleAssignmentEntity[]>;
  abstract delete(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
    scope: RoleAssignmentTransactionScope,
  ): Promise<void>;
}
