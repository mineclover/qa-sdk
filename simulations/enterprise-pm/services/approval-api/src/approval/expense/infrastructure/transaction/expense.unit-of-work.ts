// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ExpenseRepositoryPort } from "../../application/ports/expense-repository.port.js";
import type { ExpenseOutboxPort } from "../../application/ports/expense-outbox.port.js";
import type {
  ExpenseTransactionPort,
  ExpenseTransactionScope,
} from "../../application/ports/expense-transaction.port.js";

export class ExpenseUnitOfWork {
  constructor(
    private readonly transaction: ExpenseTransactionPort,
    public readonly repository: ExpenseRepositoryPort,
    public readonly outbox: ExpenseOutboxPort,
  ) {}
  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: ExpenseTransactionScope;
      readonly repository: ExpenseRepositoryPort;
      readonly outbox: ExpenseOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
