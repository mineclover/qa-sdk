// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { InvalidRoleAssignmentInputException } from './role-assignment.exceptions.js';

/** Composite key — userId + roleId + scopeType + scopeId 의 합성. */
export type RoleAssignmentId = string & { readonly __brand: 'RoleAssignmentId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type RoleId = string & { readonly __brand: 'RoleId' };

export function toUserId(value: string): UserId {
  if (value.trim().length === 0) {
    throw new InvalidRoleAssignmentInputException('userId must not be empty.');
  }
  return value as UserId;
}

export function toRoleId(value: string): RoleId {
  if (value.trim().length === 0) {
    throw new InvalidRoleAssignmentInputException('roleId must not be empty.');
  }
  return value as RoleId;
}

/** Composite key derivation. */
export function makeRoleAssignmentId(
  userId: string,
  roleId: string,
  scopeType: string,
  scopeId: string | null,
): RoleAssignmentId {
  return `${userId}|${roleId}|${scopeType}|${scopeId ?? ''}` as RoleAssignmentId;
}
