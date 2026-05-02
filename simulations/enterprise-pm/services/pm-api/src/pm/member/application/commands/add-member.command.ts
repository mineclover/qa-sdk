// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { MemberRole } from "../../domain/index.js";

/** 새 member 추가 명령. */
export interface AddMemberCommand {
  readonly projectId: string;
  readonly userId: string;
  readonly role: MemberRole;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** 멤버 제거 명령. */
export interface RemoveMemberCommand {
  readonly projectId: string;
  readonly userId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
