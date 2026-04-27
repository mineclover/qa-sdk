// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { DepartmentRepositoryPort } from "../../application/ports/department-repository.port.js";
import type { DepartmentOutboxPort } from "../../application/ports/department-outbox.port.js";
import type {
  DepartmentTransactionPort,
  DepartmentTransactionScope,
} from "../../application/ports/department-transaction.port.js";

export class DepartmentUnitOfWork {
  constructor(
    private readonly transaction: DepartmentTransactionPort,
    public readonly repository: DepartmentRepositoryPort,
    public readonly outbox: DepartmentOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: DepartmentTransactionScope;
      readonly repository: DepartmentRepositoryPort;
      readonly outbox: DepartmentOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
