import type { AssignmentCreatedEvent } from '../../application/ports/assignment-outbox.port.js';
import type { AssignmentTransactionScope } from '../../application/ports/assignment-transaction.port.js';
import type { AssignmentSnapshot } from '../../domain/index.js';

export interface AssignmentOutboxRecord {
  readonly id: string;
  readonly eventName: 'assignment.created';
  readonly eventVersion: 'v1';
  readonly aggregateId: string;
  readonly payload: AssignmentCreatedEvent;
  readonly transactionId: string;
}

export interface AssignmentUnitOfWorkScope extends AssignmentTransactionScope {
  readonly pendingAssignments: Map<string, AssignmentSnapshot>;
  readonly pendingOutbox: AssignmentOutboxRecord[];
}

export class TransactionalAssignmentStore {
  private readonly assignments = new Map<string, AssignmentSnapshot>();
  private readonly outbox: AssignmentOutboxRecord[] = [];
  private nextAutocommitId = 1;

  begin(id: string, name: string): AssignmentUnitOfWorkScope {
    return {
      id,
      name,
      pendingAssignments: new Map<string, AssignmentSnapshot>(),
      pendingOutbox: [],
    };
  }

  beginAutocommit(name: string): AssignmentUnitOfWorkScope {
    return this.begin(`${name}:${this.nextAutocommitId++}`, name);
  }

  commit(scope: AssignmentUnitOfWorkScope): void {
    for (const [id, snapshot] of scope.pendingAssignments) {
      this.assignments.set(id, snapshot);
    }
    this.outbox.push(...scope.pendingOutbox);
  }

  findAssignment(id: string): AssignmentSnapshot | null {
    return this.assignments.get(id) ?? null;
  }

  listOutbox(): readonly AssignmentOutboxRecord[] {
    return [...this.outbox];
  }
}

export function isAssignmentUnitOfWorkScope(
  scope: AssignmentTransactionScope | undefined,
): scope is AssignmentUnitOfWorkScope {
  return Boolean(scope && 'pendingAssignments' in scope && 'pendingOutbox' in scope);
}
