// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface DeleteDepartmentCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
