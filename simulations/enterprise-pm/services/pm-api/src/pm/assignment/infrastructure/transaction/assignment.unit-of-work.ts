// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { AssignmentRepositoryPort } from "../../application/ports/assignment-repository.port.js";
import type { AssignmentOutboxPort } from "../../application/ports/assignment-outbox.port.js";
import type {
  AssignmentTransactionPort,
  AssignmentTransactionScope,
} from "../../application/ports/assignment-transaction.port.js";

/**
 * Unit of Work — TransactionPort + RepositoryPort + OutboxPort 합성.
 *
 * Use-case 가 직접 transaction.run 안에서 repo + outbox 를 호출해도 되지만,
 * 합성 패턴(DDD UoW)을 슬라이스 표준으로 노출하면 다음 슬라이스 복제가
 * 균일해진다.
 *
 * - withinTransaction(name, work) 안에서 repo / outbox 를 호출하면 동일 scope
 *   가 자동 전파된다.
 * - 핸들러가 throw 하면 sqlite 어댑터는 ROLLBACK, pg 어댑터는 drizzle tx 가
 *   ROLLBACK 을 발행한다 (kit 어댑터 책임).
 */
export class AssignmentUnitOfWork {
  constructor(
    private readonly transaction: AssignmentTransactionPort,
    public readonly repository: AssignmentRepositoryPort,
    public readonly outbox: AssignmentOutboxPort,
  ) {}

  async withinTransaction<T>(
    name: string,
    work: (ctx: {
      readonly scope: AssignmentTransactionScope;
      readonly repository: AssignmentRepositoryPort;
      readonly outbox: AssignmentOutboxPort;
    }) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(name, async (scope) =>
      work({ scope, repository: this.repository, outbox: this.outbox }),
    );
  }
}
