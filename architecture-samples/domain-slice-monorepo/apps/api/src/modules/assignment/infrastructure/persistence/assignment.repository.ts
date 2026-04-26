import { AssignmentEntity } from "../../domain/index.js";
import type { AssignmentSnapshot } from "../../domain/index.js";
import { AssignmentRepositoryPort } from "../../application/ports/assignment-repository.port.js";
import type { AssignmentTransactionScope } from "../../application/ports/assignment-transaction.port.js";
import {
  isAssignmentUnitOfWorkScope,
  TransactionalAssignmentStore,
} from "../transaction/assignment.unit-of-work.js";

export class InMemoryAssignmentRepository extends AssignmentRepositoryPort {
  constructor(private readonly store: TransactionalAssignmentStore) {
    super();
  }

  async save(entity: AssignmentEntity, scope?: AssignmentTransactionScope): Promise<void> {
    const snapshot = entity.toSnapshot();
    if (isAssignmentUnitOfWorkScope(scope)) {
      scope.pendingAssignments.set(snapshot.id, snapshot);
      return;
    }
    const autocommit = this.store.beginAutocommit("assignment.autocommit");
    autocommit.pendingAssignments.set(snapshot.id, snapshot);
    this.store.commit(autocommit);
  }

  async findById(id: string): Promise<AssignmentEntity | null> {
    const row: AssignmentSnapshot | null = this.store.findAssignment(id);
    return row ? AssignmentEntity.rehydrate(row) : null;
  }
}
