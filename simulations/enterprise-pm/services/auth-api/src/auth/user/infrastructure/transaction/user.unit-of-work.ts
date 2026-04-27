// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { UserRepositoryPort } from "../../application/ports/user-repository.port.js";
import type { UserOutboxPort } from "../../application/ports/user-outbox.port.js";
import type {
  UserTransactionPort,
  UserTransactionScope,
} from "../../application/ports/user-transaction.port.js";

/**
 * Unit of Work — TransactionPort + RepositoryPort + OutboxPort 합성.
 */
export class UserUnitOfWork {
  constructor(
    private readonly transaction: UserTransactionPort,
    public readonly repository: UserRepositoryPort,
    public readonly outbox: UserOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: UserTransactionScope;
      readonly repository: UserRepositoryPort;
      readonly outbox: UserOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
