// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { InvalidBudgetIdException } from './budget.exceptions.js';

/** Branded budget request 식별자. */
export type BudgetRequestId = string & { readonly __brand: 'BudgetRequestId' };

/** Cross-aggregate ref — Project. */
export type ProjectId = string & { readonly __brand: 'ProjectId' };

/** Cross-aggregate ref — Department (project's owner department, denormalized). */
export type DepartmentId = string & { readonly __brand: 'DepartmentId' };

/** Cross-aggregate ref — Requester (User). */
export type RequesterId = string & { readonly __brand: 'RequesterId' };

/** Cross-aggregate ref — Approver (User). */
export type ApproverId = string & { readonly __brand: 'ApproverId' };

export function toBudgetRequestId(value: string): BudgetRequestId {
  if (value.trim().length === 0) {
    throw new InvalidBudgetIdException();
  }
  return value as BudgetRequestId;
}

export function toProjectId(value: string): ProjectId {
  return value as ProjectId;
}

export function toDepartmentId(value: string): DepartmentId {
  return value as DepartmentId;
}

export function toRequesterId(value: string): RequesterId {
  return value as RequesterId;
}

export function toApproverId(value: string): ApproverId {
  return value as ApproverId;
}
