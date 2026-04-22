// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { Department, DepartmentCreate } from "../shared/types.js";

@Injectable()
export class DepartmentService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository) {}

  create(args: DepartmentCreate): Promise<Department> {
    return this.repo.createDepartment(args);
  }
  find(id: string): Promise<Department | null> {
    return this.repo.findDepartment(id);
  }
  list(): Promise<Department[]> {
    return this.repo.listDepartments();
  }
  chain(id: string): Promise<Department[]> {
    return this.repo.resolveDepartmentChain(id);
  }
  update(id: string, patch: Partial<DepartmentCreate>): Promise<Department> {
    return this.repo.updateDepartment(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteDepartment(id);
  }
}
