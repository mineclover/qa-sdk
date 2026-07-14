// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { DepartmentId, ProjectId, ProjectOwnerId } from './project.ids.js';

/** 라이프사이클 상태 머신: draft → active → archived. */
export type ProjectStatus = 'draft' | 'active' | 'archived';

export interface ProjectProps {
  readonly id: ProjectId;
  readonly name: string;
  readonly ownerId: ProjectOwnerId;
  readonly departmentId: DepartmentId;
  readonly status: ProjectStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectSnapshot {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly departmentId: string;
  readonly status: ProjectStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
