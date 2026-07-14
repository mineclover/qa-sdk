// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { InvalidDepartmentInputException } from './department.exceptions.js';

export type DepartmentId = string & { readonly __brand: 'DepartmentId' };
export type ManagerId = string & { readonly __brand: 'ManagerId' };

export function toDepartmentId(value: string): DepartmentId {
  if (value.trim().length === 0) {
    throw new InvalidDepartmentInputException('DepartmentId must not be empty.');
  }
  return value as DepartmentId;
}

export function toManagerId(value: string): ManagerId {
  return value as ManagerId;
}
