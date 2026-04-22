// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { PmRepository } from "../shared/port.js";
import type { Project, ProjectCreate } from "../shared/types.js";

@Injectable()
export class ProjectService {
  constructor(@Inject(PM_REPOSITORY) private readonly repo: PmRepository) {}

  create(args: ProjectCreate): Promise<Project> {
    return this.repo.createProject(args);
  }
  find(id: string): Promise<Project | null> {
    return this.repo.findProject(id);
  }
  listByDepartment(deptId: string): Promise<Project[]> {
    return this.repo.listProjectsByDepartment(deptId);
  }
  listByOwner(ownerId: string): Promise<Project[]> {
    return this.repo.listProjectsByOwner(ownerId);
  }
  update(id: string, patch: Partial<ProjectCreate>): Promise<Project> {
    return this.repo.updateProject(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteProject(id);
  }
}
