// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { PmRepository } from "../shared/port.js";
import type { Task, TaskCreate } from "../shared/types.js";

@Injectable()
export class TaskService {
  constructor(@Inject(PM_REPOSITORY) private readonly repo: PmRepository) {}

  create(args: TaskCreate): Promise<Task> {
    return this.repo.createTask(args);
  }
  find(id: string): Promise<Task | null> {
    return this.repo.findTask(id);
  }
  listByProject(projectId: string): Promise<Task[]> {
    return this.repo.listTasksByProject(projectId);
  }
  listSubtasks(parentId: string): Promise<Task[]> {
    return this.repo.listSubtasks(parentId);
  }
  update(id: string, patch: Partial<TaskCreate>): Promise<Task> {
    return this.repo.updateTask(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteTask(id);
  }
}
