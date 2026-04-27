// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { InvalidProjectIdException } from "./project.exceptions.js";

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type ProjectId = string & { readonly __brand: "ProjectId" };

/** Owner(소유자) 식별자. */
export type ProjectOwnerId = string & { readonly __brand: "ProjectOwnerId" };

/** Department 식별자. */
export type DepartmentId = string & { readonly __brand: "DepartmentId" };

export function toProjectId(value: string): ProjectId {
  if (value.trim().length === 0) {
    throw new InvalidProjectIdException();
  }
  return value as ProjectId;
}

export function toProjectOwnerId(value: string): ProjectOwnerId {
  return value as ProjectOwnerId;
}

export function toDepartmentId(value: string): DepartmentId {
  return value as DepartmentId;
}
