// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { InvalidAssignmentIdException } from "./assignment.exceptions.js";

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type AssignmentId = string & { readonly __brand: "AssignmentId" };

/** Manager(담당자) 식별자. Assignment 와 다른 aggregate 라 별 brand. */
export type ManagerId = string & { readonly __brand: "ManagerId" };

/** Project 식별자 (cross-aggregate ref). */
export type ProjectId = string & { readonly __brand: "ProjectId" };

export function toAssignmentId(value: string): AssignmentId {
  if (value.trim().length === 0) {
    throw new InvalidAssignmentIdException();
  }
  return value as AssignmentId;
}

export function toManagerId(value: string): ManagerId {
  return value as ManagerId;
}

export function toProjectId(value: string): ProjectId {
  return value as ProjectId;
}
