// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { InvalidUserInputException } from "./user.exceptions.js";

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type UserId = string & { readonly __brand: "UserId" };

/** Department 식별자 (cross-aggregate ref). */
export type DepartmentId = string & { readonly __brand: "DepartmentId" };

/** Role 식별자 (cross-aggregate ref — primaryRoleId). */
export type RoleId = string & { readonly __brand: "RoleId" };

export function toUserId(value: string): UserId {
  if (value.trim().length === 0) {
    throw new InvalidUserInputException("UserId must not be empty.");
  }
  return value as UserId;
}

export function toDepartmentId(value: string): DepartmentId {
  return value as DepartmentId;
}

export function toRoleId(value: string): RoleId {
  return value as RoleId;
}
