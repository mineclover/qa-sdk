// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/** 인증 결과 — Roles + Department 가 합쳐진 read-side composition. */
export interface AuthenticatedSession {
  readonly userId: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
  readonly roleIds: readonly string[];
  readonly roleNames: readonly string[];
  readonly roleAssignments: readonly AuthenticatedRoleAssignment[];
}

export interface AuthenticatedRoleAssignment {
  readonly roleId: string;
  readonly roleName: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
}
