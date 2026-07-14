// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { AssignmentId, ManagerId, ProjectId } from './assignment.ids.js';

/** 상태 머신 — assignment 라이프사이클의 유한 상태. */
export type AssignmentStatus = 'draft' | 'assigned' | 'cancelled';

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface AssignmentProps {
  readonly id: AssignmentId;
  readonly projectId: ProjectId;
  readonly managerId: ManagerId;
  readonly status: AssignmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface AssignmentSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly managerId: string;
  readonly status: AssignmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
