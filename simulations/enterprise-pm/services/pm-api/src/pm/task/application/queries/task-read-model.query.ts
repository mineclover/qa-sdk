// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface TaskDetailReadModel {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly assigneeId: string | null;
  readonly status: string;
  readonly parentTaskId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Read 전용 추상 (CQRS). */
export abstract class TaskReadModelQuery {
  abstract findDetail(id: string): Promise<TaskDetailReadModel | null>;
  abstract listByProject(projectId: string): Promise<TaskDetailReadModel[]>;
  abstract listSubtasks(parentTaskId: string): Promise<TaskDetailReadModel[]>;
}
