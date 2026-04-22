// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { User, UserCreate } from "../shared/types.js";

@Injectable()
export class UserService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository) {}

  create(args: UserCreate): Promise<User> {
    return this.repo.createUser(args);
  }
  find(id: string): Promise<User | null> {
    return this.repo.findUser(id);
  }
  findByEmail(email: string): Promise<User | null> {
    return this.repo.findUserByEmail(email);
  }
  listByDepartment(deptId: string): Promise<User[]> {
    return this.repo.listUsersByDepartment(deptId);
  }
  update(id: string, patch: Partial<UserCreate>): Promise<User> {
    return this.repo.updateUser(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteUser(id);
  }
}
