// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { InvalidTaskIdException } from './task.exceptions.js';

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type TaskId = string & { readonly __brand: 'TaskId' };

/** Project 식별자 (cross-aggregate ref). */
export type TaskProjectId = string & { readonly __brand: 'TaskProjectId' };

/** Assignee(담당자) 식별자. */
export type AssigneeId = string & { readonly __brand: 'AssigneeId' };

export function toTaskId(value: string): TaskId {
  if (value.trim().length === 0) {
    throw new InvalidTaskIdException();
  }
  return value as TaskId;
}

export function toTaskProjectId(value: string): TaskProjectId {
  return value as TaskProjectId;
}

export function toAssigneeId(value: string): AssigneeId {
  return value as AssigneeId;
}
