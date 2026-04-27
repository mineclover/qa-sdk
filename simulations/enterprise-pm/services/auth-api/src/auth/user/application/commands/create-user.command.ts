// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/** User 생성 명령 (use-case 입력). */
export interface CreateUserCommand {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly departmentId?: string | null;
  readonly primaryRoleId?: string | null;
  readonly traceId?: string;
  readonly correlationId?: string;
}
