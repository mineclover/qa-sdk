// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface RoleAssignmentViewForAuthenticate {
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
}

/** Cross-domain — role-assignment 슬라이스 read model 의 일부만 노출. */
export abstract class RoleAssignmentQueryPort {
  abstract listForUser(userId: string): Promise<RoleAssignmentViewForAuthenticate[]>;
}
