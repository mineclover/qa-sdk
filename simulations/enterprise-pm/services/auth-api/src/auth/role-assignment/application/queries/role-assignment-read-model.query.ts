// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface RoleAssignmentReadModel {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
  readonly assignedAt: string;
}

export abstract class RoleAssignmentReadModelQuery {
  abstract findOne(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<RoleAssignmentReadModel | null>;
  abstract listForUser(userId: string): Promise<RoleAssignmentReadModel[]>;
}
