// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { NotificationRepositoryPort } from '../../application/ports/notification-repository.port.js';
import type { NotificationOutboxPort } from '../../application/ports/notification-outbox.port.js';
import type {
  NotificationTransactionPort,
  NotificationTransactionScope,
} from '../../application/ports/notification-transaction.port.js';

/**
 * Unit of Work — TransactionPort + RepositoryPort + OutboxPort 합성.
 */
export class NotificationUnitOfWork {
  constructor(
    private readonly transaction: NotificationTransactionPort,
    public readonly repository: NotificationRepositoryPort,
    public readonly outbox: NotificationOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: NotificationTransactionScope;
      readonly repository: NotificationRepositoryPort;
      readonly outbox: NotificationOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
