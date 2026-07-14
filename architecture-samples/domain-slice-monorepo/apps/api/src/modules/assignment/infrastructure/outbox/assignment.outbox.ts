import type { AssignmentCreatedEvent } from '../../application/ports/assignment-outbox.port.js';
import { AssignmentOutboxPort } from '../../application/ports/assignment-outbox.port.js';
import type { AssignmentTransactionScope } from '../../application/ports/assignment-transaction.port.js';
import {
  isAssignmentUnitOfWorkScope,
  TransactionalAssignmentStore,
} from '../transaction/assignment.unit-of-work.js';

export class ConsoleAssignmentOutbox extends AssignmentOutboxPort {
  constructor(private readonly store: TransactionalAssignmentStore) {
    super();
  }

  async appendCreated(
    event: AssignmentCreatedEvent,
    scope?: AssignmentTransactionScope,
  ): Promise<void> {
    const createRecord = (transactionId: string) => ({
      id: `assignment.created:${event.id}:${transactionId}`,
      eventName: 'assignment.created' as const,
      eventVersion: 'v1' as const,
      aggregateId: event.id,
      payload: event,
      transactionId,
    });

    if (isAssignmentUnitOfWorkScope(scope)) {
      scope.pendingOutbox.push(createRecord(scope.id));
      return;
    }

    const autocommit = this.store.beginAutocommit('assignment.autocommit');
    autocommit.pendingOutbox.push(createRecord(autocommit.id));
    this.store.commit(autocommit);
  }
}
