// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { UserId, RoleId, RoleAssignmentId } from './role-assignment.ids.js';

export type AssignmentScopeType = 'global' | 'department' | 'project';

export interface RoleAssignmentProps {
  readonly id: RoleAssignmentId;
  readonly userId: UserId;
  readonly roleId: RoleId;
  readonly scopeType: AssignmentScopeType;
  readonly scopeId: string | null;
  readonly assignedAt: Date;
}

export interface RoleAssignmentSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: AssignmentScopeType;
  readonly scopeId: string | null;
  readonly assignedAt: string;
}
