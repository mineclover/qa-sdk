// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  ResourceReadModelQuery,
  type ResourceDetailReadModel,
} from "../../application/queries/resource-read-model.query.js";
import type { ResourceRepositoryPort } from "../../application/ports/resource-repository.port.js";

export class RepositoryResourceReadModel extends ResourceReadModelQuery {
  constructor(private readonly repository: ResourceRepositoryPort) {
    super();
  }
  async findDetail(id: string): Promise<ResourceDetailReadModel | null> {
    const e = await this.repository.findById(id);
    if (!e) return null;
    const s = e.toSnapshot();
    return {
      id: s.id,
      projectId: s.projectId,
      requesterId: s.requesterId,
      resourceType: s.resourceType,
      description: s.description,
      status: s.status,
      updatedAt: s.updatedAt,
    };
  }
}
