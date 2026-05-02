// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface AuthenticateCommand {
  readonly email: string;
  readonly password: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
