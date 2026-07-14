// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { TaskRepositoryPort } from '../../application/ports/task-repository.port.js';
import type { TaskOutboxPort } from '../../application/ports/task-outbox.port.js';
import type {
  TaskTransactionPort,
  TaskTransactionScope,
} from '../../application/ports/task-transaction.port.js';

export class TaskUnitOfWork {
  constructor(
    private readonly transaction: TaskTransactionPort,
    public readonly repository: TaskRepositoryPort,
    public readonly outbox: TaskOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: TaskTransactionScope;
      readonly repository: TaskRepositoryPort;
      readonly outbox: TaskOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
