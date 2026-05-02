// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  AssignmentReadModelQuery,
  type AssignmentDetailReadModel,
} from "../../application/queries/assignment-read-model.query.js";
import type { AssignmentRepositoryPort } from "../../application/ports/assignment-repository.port.js";

/**
 * Repository 위에 얇게 얹은 Read Model.
 *
 * Phase 1 의 단순 슬라이스에서는 read model projector 가 없고 entity 를
 * 그대로 detail DTO 로 매핑한다. Phase 2 의 reporting 슬라이스가 본격적인
 * read model projection 을 다룬다.
 */
export class RepositoryAssignmentReadModel extends AssignmentReadModelQuery {
  constructor(private readonly repository: AssignmentRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<AssignmentDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    const snapshot = entity.toSnapshot();
    return {
      id: snapshot.id,
      projectId: snapshot.projectId,
      managerId: snapshot.managerId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
    };
  }
}
