// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { DocumentRepositoryPort } from "../../application/ports/document-repository.port.js";
import type { DocumentOutboxPort } from "../../application/ports/document-outbox.port.js";
import type {
  DocumentTransactionPort,
  DocumentTransactionScope,
} from "../../application/ports/document-transaction.port.js";

/**
 * Unit of Work — TransactionPort + RepositoryPort + OutboxPort 합성.
 */
export class DocumentUnitOfWork {
  constructor(
    private readonly transaction: DocumentTransactionPort,
    public readonly repository: DocumentRepositoryPort,
    public readonly outbox: DocumentOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: DocumentTransactionScope;
      readonly repository: DocumentRepositoryPort;
      readonly outbox: DocumentOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
