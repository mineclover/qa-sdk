// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { InvalidTimeOffIdException } from "./timeoff.exceptions.js";

export type TimeOffRequestId = string & { readonly __brand: "TimeOffRequestId" };
export type RequesterId = string & { readonly __brand: "RequesterId" };

export function toTimeOffRequestId(value: string): TimeOffRequestId {
  if (value.trim().length === 0) throw new InvalidTimeOffIdException();
  return value as TimeOffRequestId;
}
export function toRequesterId(v: string): RequesterId {
  return v as RequesterId;
}
