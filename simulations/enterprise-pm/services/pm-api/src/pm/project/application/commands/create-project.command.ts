// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { ProjectStatus } from '../../domain/index.js';

/** 새 project 생성 명령. */
export interface CreateProjectCommand {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly departmentId: string;
  readonly status?: ProjectStatus;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** project 패치 명령. */
export interface UpdateProjectCommand {
  readonly id: string;
  readonly patch: {
    readonly name?: string;
    readonly ownerId?: string;
    readonly departmentId?: string;
    readonly status?: ProjectStatus;
  };
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** project 삭제 명령. */
export interface DeleteProjectCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** project delegate 명령 (policy lifecycle: UNREGISTERED→REGISTERED→DELEGATED). */
export interface DelegateProjectCommand {
  readonly id: string;
  readonly graphRootId: string;
  readonly delegateUserId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** delegate principal 추가 명령. */
export interface AddProjectDelegateCommand {
  readonly id: string;
  readonly delegateUserId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
