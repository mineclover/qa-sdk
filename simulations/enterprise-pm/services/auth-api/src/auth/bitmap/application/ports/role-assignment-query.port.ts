// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface RoleAssignmentViewForBitmap {
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
}

export abstract class RoleAssignmentQueryPort {
  abstract listForUser(userId: string): Promise<RoleAssignmentViewForBitmap[]>;
}
