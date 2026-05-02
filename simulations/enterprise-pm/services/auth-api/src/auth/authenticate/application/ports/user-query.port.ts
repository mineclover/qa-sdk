// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface UserViewForAuthenticate {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId: string | null;
  readonly primaryRoleId: string | null;
}

/** Cross-domain — user 슬라이스 read model 의 일부만 노출. */
export abstract class UserQueryPort {
  abstract findByEmail(email: string): Promise<UserViewForAuthenticate | null>;
}
