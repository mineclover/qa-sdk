// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { TimeOffRepositoryPort } from '../../application/ports/timeoff-repository.port.js';
import type { TimeOffOutboxPort } from '../../application/ports/timeoff-outbox.port.js';
import type {
  TimeOffTransactionPort,
  TimeOffTransactionScope,
} from '../../application/ports/timeoff-transaction.port.js';

export class TimeOffUnitOfWork {
  constructor(
    private readonly transaction: TimeOffTransactionPort,
    public readonly repository: TimeOffRepositoryPort,
    public readonly outbox: TimeOffOutboxPort,
  ) {}
  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: TimeOffTransactionScope;
      readonly repository: TimeOffRepositoryPort;
      readonly outbox: TimeOffOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
