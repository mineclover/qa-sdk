// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { AssignmentScopeType } from '../../domain/index.js';

export interface AssignRoleCommand {
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: AssignmentScopeType;
  readonly scopeId: string | null;
  readonly traceId?: string;
  readonly correlationId?: string;
}
