// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleScopeType } from "../../domain/role.types.js";

export interface CreateRoleCommand {
  readonly id: string;
  readonly name: string;
  readonly scopeType: RoleScopeType;
  readonly defaultMaskHex: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
