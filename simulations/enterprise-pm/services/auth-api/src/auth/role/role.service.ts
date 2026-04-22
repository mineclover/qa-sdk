// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { Role, RoleCreate } from "../shared/types.js";

@Injectable()
export class RoleService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository) {}

  create(args: RoleCreate): Promise<Role> {
    return this.repo.createRole(args);
  }
  find(id: string): Promise<Role | null> {
    return this.repo.findRole(id);
  }
  list(): Promise<Role[]> {
    return this.repo.listRoles();
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteRole(id);
  }
}
