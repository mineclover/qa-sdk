// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BudgetRepositoryPort } from '../../application/ports/budget-repository.port.js';
import type { BudgetOutboxPort } from '../../application/ports/budget-outbox.port.js';
import type {
  BudgetTransactionPort,
  BudgetTransactionScope,
} from '../../application/ports/budget-transaction.port.js';

export class BudgetUnitOfWork {
  constructor(
    private readonly transaction: BudgetTransactionPort,
    public readonly repository: BudgetRepositoryPort,
    public readonly outbox: BudgetOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: BudgetTransactionScope;
      readonly repository: BudgetRepositoryPort;
      readonly outbox: BudgetOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
