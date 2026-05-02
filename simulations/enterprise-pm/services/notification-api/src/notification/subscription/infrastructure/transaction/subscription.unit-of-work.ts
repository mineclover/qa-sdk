// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { SubscriptionRepositoryPort } from "../../application/ports/subscription-repository.port.js";
import type { SubscriptionOutboxPort } from "../../application/ports/subscription-outbox.port.js";
import type {
  SubscriptionTransactionPort,
  SubscriptionTransactionScope,
} from "../../application/ports/subscription-transaction.port.js";

export class SubscriptionUnitOfWork {
  constructor(
    private readonly transaction: SubscriptionTransactionPort,
    public readonly repository: SubscriptionRepositoryPort,
    public readonly outbox: SubscriptionOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: SubscriptionTransactionScope;
      readonly repository: SubscriptionRepositoryPort;
      readonly outbox: SubscriptionOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
