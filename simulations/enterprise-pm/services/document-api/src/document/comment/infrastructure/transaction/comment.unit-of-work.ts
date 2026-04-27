// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { CommentRepositoryPort } from "../../application/ports/comment-repository.port.js";
import type { CommentOutboxPort } from "../../application/ports/comment-outbox.port.js";
import type {
  CommentTransactionPort,
  CommentTransactionScope,
} from "../../application/ports/comment-transaction.port.js";

export class CommentUnitOfWork {
  constructor(
    private readonly transaction: CommentTransactionPort,
    public readonly repository: CommentRepositoryPort,
    public readonly outbox: CommentOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: CommentTransactionScope;
      readonly repository: CommentRepositoryPort;
      readonly outbox: CommentOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
