// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import type { TransactionScope } from "./transaction.port.js";

/**
 * 도메인 이벤트의 outbox 레코드 표준 shape.
 *
 * - aggregateId: 이벤트가 속한 aggregate root 의 식별자
 * - eventName: 도메인 이벤트의 정규 이름 (예: "approval.budget.submitted")
 * - eventVersion: 동일 이름 내 스키마 버전 (1 부터 시작)
 * - payload: 도메인 이벤트의 직렬화 가능한 본문
 * - occurredAt: 이벤트가 도메인 관점에서 발생한 시각
 * - idempotencyKey: grammar #12(`buildIdempotencyKey`)로 합성한 정규 키.
 *   raw 보간(`${aggregateId}:${eventName}:${epoch}`) 금지 — consumer 측 dispatcher 가
 *   `parseIdempotencyKey` 로 형식을 한 번 더 검증해 raw 보간 row 를 즉시 식별한다.
 */
export interface OutboxRecord {
  readonly aggregateId: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly idempotencyKey: string;
}

/**
 * 도메인 슬라이스가 의존하는 outbox 추상.
 *
 * - append 는 트랜잭션 스코프 내부에서 호출되어야 한다 (atomicity 보장)
 * - 구현체는 슬라이스의 outbox 테이블에 INSERT
 */
export interface OutboxPort {
  append(record: OutboxRecord, scope: TransactionScope): Promise<void>;
}
