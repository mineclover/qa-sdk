// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleAssignmentRepositoryPort } from "../../application/ports/role-assignment-repository.port.js";
import type { RoleAssignmentOutboxPort } from "../../application/ports/role-assignment-outbox.port.js";
import type {
  RoleAssignmentTransactionPort,
  RoleAssignmentTransactionScope,
} from "../../application/ports/role-assignment-transaction.port.js";

export class RoleAssignmentUnitOfWork {
  constructor(
    private readonly transaction: RoleAssignmentTransactionPort,
    public readonly repository: RoleAssignmentRepositoryPort,
    public readonly outbox: RoleAssignmentOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: RoleAssignmentTransactionScope;
      readonly repository: RoleAssignmentRepositoryPort;
      readonly outbox: RoleAssignmentOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
