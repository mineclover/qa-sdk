// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { InvalidResourceIdException, InvalidResourceTypeException } from './resource.exceptions.js';

export type ResourceRequestId = string & { readonly __brand: 'ResourceRequestId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type RequesterId = string & { readonly __brand: 'RequesterId' };
export type ResourceTypeId = string & { readonly __brand: 'ResourceTypeId' };

export function toResourceRequestId(value: string): ResourceRequestId {
  if (value.trim().length === 0) throw new InvalidResourceIdException();
  return value as ResourceRequestId;
}
export function toProjectId(v: string): ProjectId {
  return v as ProjectId;
}
export function toRequesterId(v: string): RequesterId {
  return v as RequesterId;
}
export function toResourceTypeId(value: string): ResourceTypeId {
  if (value.trim().length === 0) throw new InvalidResourceTypeException();
  return value as ResourceTypeId;
}
