// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ResourceRepositoryPort } from "../../application/ports/resource-repository.port.js";
import type { ResourceOutboxPort } from "../../application/ports/resource-outbox.port.js";
import type {
  ResourceTransactionPort,
  ResourceTransactionScope,
} from "../../application/ports/resource-transaction.port.js";

export class ResourceUnitOfWork {
  constructor(
    private readonly transaction: ResourceTransactionPort,
    public readonly repository: ResourceRepositoryPort,
    public readonly outbox: ResourceOutboxPort,
  ) {}
  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: ResourceTransactionScope;
      readonly repository: ResourceRepositoryPort;
      readonly outbox: ResourceOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
