// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { randomUUID } from 'node:crypto';
import type { TransactionPort, TransactionScope } from '../transaction.port.js';

/**
 * 슬라이스에서 사용할 SQLite TransactionPort 어댑터가 의존하는 최소 구조.
 *
 * better-sqlite3 의 native `db.transaction()` 은 async callback 을 지원하지
 * 않는다 (Promise 반환 시 throw). 따라서 본 어댑터는 raw BEGIN/COMMIT/ROLLBACK
 * 을 발급하는 더 일반적인 인터페이스에 의존한다. drizzle better-sqlite3 의
 * `db.run(sql)` 메서드가 이 시그니처를 만족한다.
 *
 * @param run drizzle better-sqlite3 의 run 함수 (또는 동일 시그니처의 함수)
 */
export interface DrizzleSqliteLike {
  /** drizzle 의 sql 태그된 쿼리를 받아 실행. (`Promise<unknown>` 또는 `unknown` 반환) */
  run(query: unknown): Promise<unknown> | unknown;
}

/**
 * 슬라이스에서 사용할 SQLite TransactionPort 어댑터.
 *
 * - better-sqlite3 의 native transaction 은 promise 미지원이므로 BEGIN/COMMIT
 *   /ROLLBACK 을 직접 발행한다 (drizzle 의 sql 템플릿 사용).
 * - work() 가 throw 하면 ROLLBACK
 * - 정상 반환 시 COMMIT
 *
 * @param db drizzle better-sqlite3 인스턴스 (또는 호환 객체)
 * @param sqlTag drizzle 의 `sql` 템플릿 (의존성 역전)
 */
export function createSqliteTransactionPort(
  db: DrizzleSqliteLike,
  sqlTag: (strings: TemplateStringsArray) => unknown,
): TransactionPort {
  return {
    async run<T>(name: string, work: (scope: TransactionScope) => Promise<T>): Promise<T> {
      const scope: TransactionScope = {
        id: `${name}:${randomUUID()}`,
        startedAt: new Date(),
      };
      await db.run(sqlTag`BEGIN`);
      try {
        const result = await work(scope);
        await db.run(sqlTag`COMMIT`);
        return result;
      } catch (err) {
        try {
          await db.run(sqlTag`ROLLBACK`);
        } catch {
          // 이미 트랜잭션이 깨진 경우의 보조 정리 — 원본 에러를 우선 전달.
        }
        throw err;
      }
    },
  };
}
