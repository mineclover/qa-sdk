// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  UserReadModelQuery,
  type UserDetailReadModel,
} from "../../application/queries/user-read-model.query.js";
import type { UserRepositoryPort } from "../../application/ports/user-repository.port.js";

/**
 * Repository 위에 얹은 Read Model — Phase 2 단순 슬라이스용.
 */
export class RepositoryUserReadModel extends UserReadModelQuery {
  constructor(private readonly repository: UserRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<UserDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return mapToReadModel(entity.toSnapshot());
  }

  async findByEmail(email: string): Promise<UserDetailReadModel | null> {
    const entity = await this.repository.findByEmail(email);
    if (!entity) return null;
    return mapToReadModel(entity.toSnapshot());
  }

  async listByDepartment(departmentId: string): Promise<UserDetailReadModel[]> {
    const list = await this.repository.listByDepartment(departmentId);
    return list.map((u) => mapToReadModel(u.toSnapshot()));
  }
}

function mapToReadModel(s: {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  primaryRoleId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}): UserDetailReadModel {
  return {
    id: s.id,
    email: s.email,
    displayName: s.displayName,
    departmentId: s.departmentId,
    primaryRoleId: s.primaryRoleId,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
