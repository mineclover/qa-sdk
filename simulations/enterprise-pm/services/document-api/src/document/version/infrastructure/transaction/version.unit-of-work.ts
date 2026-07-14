// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { VersionRepositoryPort } from '../../application/ports/version-repository.port.js';
import type { VersionOutboxPort } from '../../application/ports/version-outbox.port.js';
import type {
  VersionTransactionPort,
  VersionTransactionScope,
} from '../../application/ports/version-transaction.port.js';

export class VersionUnitOfWork {
  constructor(
    private readonly transaction: VersionTransactionPort,
    public readonly repository: VersionRepositoryPort,
    public readonly outbox: VersionOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: VersionTransactionScope;
      readonly repository: VersionRepositoryPort;
      readonly outbox: VersionOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
