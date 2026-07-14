// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleRepositoryPort } from '../../application/ports/role-repository.port.js';
import type { RoleOutboxPort } from '../../application/ports/role-outbox.port.js';
import type {
  RoleTransactionPort,
  RoleTransactionScope,
} from '../../application/ports/role-transaction.port.js';

export class RoleUnitOfWork {
  constructor(
    private readonly transaction: RoleTransactionPort,
    public readonly repository: RoleRepositoryPort,
    public readonly outbox: RoleOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: RoleTransactionScope;
      readonly repository: RoleRepositoryPort;
      readonly outbox: RoleOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
