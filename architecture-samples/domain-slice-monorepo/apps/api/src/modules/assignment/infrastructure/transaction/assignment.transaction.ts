import { AssignmentTransactionPort } from '../../application/ports/assignment-transaction.port.js';
import type { AssignmentTransactionScope } from '../../application/ports/assignment-transaction.port.js';
import { TransactionalAssignmentStore } from './assignment.unit-of-work.js';

export class InMemoryAssignmentTransaction extends AssignmentTransactionPort {
  private nextId = 1;

  constructor(private readonly store: TransactionalAssignmentStore) {
    super();
  }

  async run<T>(
    name: string,
    handler: (scope: AssignmentTransactionScope) => Promise<T>,
  ): Promise<T> {
    const scope = this.store.begin(`${name}:${this.nextId++}`, name);
    const result = await handler(scope);
    this.store.commit(scope);
    return result;
  }
}
