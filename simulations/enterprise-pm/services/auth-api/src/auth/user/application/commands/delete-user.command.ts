// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/** User 삭제 명령 (hard delete — legacy 호환). */
export interface DeleteUserCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
