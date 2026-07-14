// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  RoleAssignmentReadModelQuery,
  type RoleAssignmentReadModel,
} from '../../application/queries/role-assignment-read-model.query.js';
import type { RoleAssignmentRepositoryPort } from '../../application/ports/role-assignment-repository.port.js';

export class RepositoryRoleAssignmentReadModel extends RoleAssignmentReadModelQuery {
  constructor(private readonly repository: RoleAssignmentRepositoryPort) {
    super();
  }

  async findOne(
    userId: string,
    roleId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<RoleAssignmentReadModel | null> {
    const e = await this.repository.findOne(userId, roleId, scopeType, scopeId);
    return e ? toReadModel(e.toSnapshot()) : null;
  }

  async listForUser(userId: string): Promise<RoleAssignmentReadModel[]> {
    const list = await this.repository.listForUser(userId);
    return list.map((ra) => toReadModel(ra.toSnapshot()));
  }
}

function toReadModel(s: {
  id: string;
  userId: string;
  roleId: string;
  scopeType: string;
  scopeId: string | null;
  assignedAt: string;
}): RoleAssignmentReadModel {
  return s;
}
