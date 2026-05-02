// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { MemberRepositoryPort } from "../../application/ports/member-repository.port.js";
import type { MemberOutboxPort } from "../../application/ports/member-outbox.port.js";
import type {
  MemberTransactionPort,
  MemberTransactionScope,
} from "../../application/ports/member-transaction.port.js";

export class MemberUnitOfWork {
  constructor(
    private readonly transaction: MemberTransactionPort,
    public readonly repository: MemberRepositoryPort,
    public readonly outbox: MemberOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: MemberTransactionScope;
      readonly repository: MemberRepositoryPort;
      readonly outbox: MemberOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
