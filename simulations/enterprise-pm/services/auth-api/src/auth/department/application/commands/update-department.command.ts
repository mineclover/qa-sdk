// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface UpdateDepartmentCommand {
  readonly id: string;
  readonly patch: {
    readonly name?: string;
    readonly parentId?: string | null;
    readonly managerId?: string | null;
  };
  readonly traceId?: string;
  readonly correlationId?: string;
}
