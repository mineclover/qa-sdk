// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/** User 부분 갱신 명령. */
export interface UpdateUserCommand {
  readonly id: string;
  readonly patch: {
    readonly email?: string;
    readonly displayName?: string;
    readonly departmentId?: string | null;
    readonly primaryRoleId?: string | null;
  };
  readonly traceId?: string;
  readonly correlationId?: string;
}
