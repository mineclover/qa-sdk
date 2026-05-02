// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface DeleteRoleCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
