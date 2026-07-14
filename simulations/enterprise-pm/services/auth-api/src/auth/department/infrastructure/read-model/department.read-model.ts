// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  DepartmentReadModelQuery,
  type DepartmentDetailReadModel,
} from '../../application/queries/department-read-model.query.js';
import type { DepartmentRepositoryPort } from '../../application/ports/department-repository.port.js';

export class RepositoryDepartmentReadModel extends DepartmentReadModelQuery {
  constructor(private readonly repository: DepartmentRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<DepartmentDetailReadModel | null> {
    const e = await this.repository.findById(id);
    return e ? mapToReadModel(e.toSnapshot()) : null;
  }

  async list(): Promise<DepartmentDetailReadModel[]> {
    const list = await this.repository.list();
    return list.map((d) => mapToReadModel(d.toSnapshot()));
  }

  async resolveChain(id: string): Promise<DepartmentDetailReadModel[]> {
    const chain = await this.repository.resolveChain(id);
    return chain.map((d) => mapToReadModel(d.toSnapshot()));
  }
}

function mapToReadModel(s: {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}): DepartmentDetailReadModel {
  return s;
}
