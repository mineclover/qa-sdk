// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { AssigneeId, TaskId, TaskProjectId } from './task.ids.js';

/** 상태 머신 — task 라이프사이클의 유한 상태. */
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface TaskProps {
  readonly id: TaskId;
  readonly projectId: TaskProjectId;
  readonly title: string;
  readonly assigneeId: AssigneeId | null;
  readonly status: TaskStatus;
  readonly parentTaskId: TaskId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface TaskSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly assigneeId: string | null;
  readonly status: TaskStatus;
  readonly parentTaskId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
