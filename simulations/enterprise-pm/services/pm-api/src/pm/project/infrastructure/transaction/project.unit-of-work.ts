// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { ProjectRepositoryPort } from '../../application/ports/project-repository.port.js';
import type { ProjectOutboxPort } from '../../application/ports/project-outbox.port.js';
import type {
  ProjectTransactionPort,
  ProjectTransactionScope,
} from '../../application/ports/project-transaction.port.js';

export class ProjectUnitOfWork {
  constructor(
    private readonly transaction: ProjectTransactionPort,
    public readonly repository: ProjectRepositoryPort,
    public readonly outbox: ProjectOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: ProjectTransactionScope;
      readonly repository: ProjectRepositoryPort;
      readonly outbox: ProjectOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
