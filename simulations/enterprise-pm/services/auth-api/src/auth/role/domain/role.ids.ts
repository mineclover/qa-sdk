// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { InvalidRoleInputException } from "./role.exceptions.js";

export type RoleId = string & { readonly __brand: "RoleId" };

export function toRoleId(value: string): RoleId {
  if (value.trim().length === 0) {
    throw new InvalidRoleInputException("RoleId must not be empty.");
  }
  return value as RoleId;
}
