// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  InvalidMemberProjectIdException,
  InvalidMemberUserIdException,
} from './member.exceptions.js';

/** Project (cross-aggregate ref). */
export type MemberProjectId = string & { readonly __brand: 'MemberProjectId' };

/** User 식별자. */
export type MemberUserId = string & { readonly __brand: 'MemberUserId' };

export function toMemberProjectId(value: string): MemberProjectId {
  if (value.trim().length === 0) throw new InvalidMemberProjectIdException();
  return value as MemberProjectId;
}

export function toMemberUserId(value: string): MemberUserId {
  if (value.trim().length === 0) throw new InvalidMemberUserIdException();
  return value as MemberUserId;
}
