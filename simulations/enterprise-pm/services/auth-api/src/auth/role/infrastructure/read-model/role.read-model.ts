// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  RoleReadModelQuery,
  type RoleDetailReadModel,
} from "../../application/queries/role-read-model.query.js";
import type { RoleRepositoryPort } from "../../application/ports/role-repository.port.js";

export class RepositoryRoleReadModel extends RoleReadModelQuery {
  constructor(private readonly repository: RoleRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<RoleDetailReadModel | null> {
    const e = await this.repository.findById(id);
    return e ? toReadModel(e.toSnapshot()) : null;
  }

  async findByName(name: string): Promise<RoleDetailReadModel | null> {
    const e = await this.repository.findByName(name);
    return e ? toReadModel(e.toSnapshot()) : null;
  }

  async list(): Promise<RoleDetailReadModel[]> {
    const list = await this.repository.list();
    return list.map((r) => toReadModel(r.toSnapshot()));
  }
}

function toReadModel(s: {
  id: string;
  name: string;
  scopeType: string;
  defaultMaskHex: string;
  createdAt: string;
}): RoleDetailReadModel {
  return s;
}
