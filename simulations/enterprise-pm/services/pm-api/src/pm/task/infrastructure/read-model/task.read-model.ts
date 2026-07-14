// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  TaskReadModelQuery,
  type TaskDetailReadModel,
} from '../../application/queries/task-read-model.query.js';
import type { TaskRepositoryPort } from '../../application/ports/task-repository.port.js';
import type { TaskEntity } from '../../domain/index.js';

export class RepositoryTaskReadModel extends TaskReadModelQuery {
  constructor(private readonly repository: TaskRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<TaskDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return toDetail(entity);
  }

  async listByProject(projectId: string): Promise<TaskDetailReadModel[]> {
    const entities = await this.repository.listByProject(projectId);
    return entities.map(toDetail);
  }

  async listSubtasks(parentTaskId: string): Promise<TaskDetailReadModel[]> {
    const entities = await this.repository.listSubtasks(parentTaskId);
    return entities.map(toDetail);
  }
}

function toDetail(entity: TaskEntity): TaskDetailReadModel {
  const snapshot = entity.toSnapshot();
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    title: snapshot.title,
    assigneeId: snapshot.assigneeId,
    status: snapshot.status,
    parentTaskId: snapshot.parentTaskId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
