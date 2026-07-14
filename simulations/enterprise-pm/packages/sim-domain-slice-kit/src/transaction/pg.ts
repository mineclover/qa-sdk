// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { randomUUID } from 'node:crypto';
import type { TransactionPort, TransactionScope } from '../transaction.port.js';

/**
 * drizzle 의 transaction 메서드만 의존하는 최소 구조 타입.
 *
 * drizzle node-postgres / postgres-js 가 모두 동일 시그니처를 제공한다.
 * simulations/enterprise-pm 환경은 postgres-js 를 사용하지만, 본 어댑터는
 * driver 비종속.
 *
 * NOTE: phase-0 spec 은 "drizzle-orm/node-postgres" 를 명시했으나 sim 환경의
 * pg-api 는 postgres-js 를 사용한다. 본 어댑터는 두 driver 모두 호환되도록
 * 구조 타입에만 의존한다.
 */
export interface DrizzlePgLike {
  transaction<T>(handler: (tx: unknown) => Promise<T> | T): Promise<T>;
}

/**
 * 슬라이스에서 사용할 Postgres TransactionPort 어댑터.
 *
 * @param db drizzle pg 인스턴스 (postgres-js 또는 node-postgres)
 */
export function createPgTransactionPort(db: DrizzlePgLike): TransactionPort {
  return {
    async run<T>(name: string, work: (scope: TransactionScope) => Promise<T>): Promise<T> {
      return db.transaction(async (_tx) => {
        const scope: TransactionScope = {
          id: `${name}:${randomUUID()}`,
          startedAt: new Date(),
        };
        return work(scope);
      });
    },
  };
}
