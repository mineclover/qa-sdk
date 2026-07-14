import { AssignmentReadModelPort } from '../../application/queries/assignment-read-model.query.js';
import type { AssignmentDetailReadModel } from '../../application/queries/assignment-read-model.query.js';
import type { AssignmentRepositoryPort } from '../../application/ports/assignment-repository.port.js';

export class RepositoryAssignmentReadModel extends AssignmentReadModelPort {
  constructor(private readonly repository: AssignmentRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<AssignmentDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;

    const snapshot = entity.toSnapshot();
    return {
      id: snapshot.id,
      assigneeId: snapshot.assigneeId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
    };
  }
}
