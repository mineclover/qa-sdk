// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { MemberProjectId, MemberUserId } from "./member.ids.js";

/** 멤버 역할 — 라이프사이클 상태 머신. */
export type MemberRole = "lead" | "contributor" | "viewer";

export interface MemberProps {
  readonly projectId: MemberProjectId;
  readonly userId: MemberUserId;
  readonly role: MemberRole;
  readonly joinedAt: Date;
}

export interface MemberSnapshot {
  readonly projectId: string;
  readonly userId: string;
  readonly role: MemberRole;
  readonly joinedAt: string;
}
