// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

/**
 * 트랜잭션 스코프. use-case 가 한 단위 작업에서 공유하는 컨텍스트.
 *
 * - id: 어댑터가 발급하는 고유 식별자 (예: drizzle tx 식별자 + nonce)
 * - startedAt: 시작 시각. logger/outbox 가 occurredAt 으로 활용 가능
 */
export interface TransactionScope {
  readonly id: string;
  readonly startedAt: Date;
}

/**
 * 도메인 슬라이스의 use-case 가 의존하는 트랜잭션 추상.
 *
 * 어댑터(`createSqliteTransactionPort`/`createPgTransactionPort`) 는 drizzle
 * 트랜잭션 위에 scope 를 합성한다. 스코프 내부에서 던져진 에러는 rollback,
 * 정상 반환은 commit 으로 이어져야 한다.
 */
export interface TransactionPort {
  run<T>(name: string, work: (scope: TransactionScope) => Promise<T>): Promise<T>;
}
