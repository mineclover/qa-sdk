// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * spec 04 §2.2 — sim.outbox_consumer_log 테이블.
 *
 * 다중 dispatcher 환경에서 같은 이벤트를 두 번 처리하지 않도록 consumer 측에서
 * `(idempotency_key, consumer)` UNIQUE 제약으로 race를 흡수한다. INSERT 충돌은
 * `ON CONFLICT DO NOTHING`으로 silent skip — 두 dispatcher 가 같은 이벤트에 진입해도
 * 한 행만 살아남고 나머지는 skip 한다.
 *
 * - idempotency_key: grammar #12(`buildIdempotencyKey`)로 합성한 정규 키
 * - consumer: 처리 주체(서비스 prefix). 서비스가 여러 분기일 때 같은 키가 다른 consumer 로
 *             다시 처리되는 것은 정당하므로 (key, consumer) 복합 UNIQUE.
 * - processed_at: 처리 완료 시각(epoch ms).
 */
import { pgSchema, text, bigint, uniqueIndex } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const outboxConsumerLog = sim.table(
  'outbox_consumer_log',
  {
    idempotency_key: text('idempotency_key').notNull(),
    consumer: text('consumer').notNull(),
    processed_at: bigint('processed_at', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('uq_sim_outbox_consumer_log_key').on(t.idempotency_key, t.consumer)],
);

export const SIM_OUTBOX_CONSUMER_LOG_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;
CREATE TABLE IF NOT EXISTS sim.outbox_consumer_log (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at BIGINT NOT NULL,
  CONSTRAINT uq_sim_outbox_consumer_log_key UNIQUE (idempotency_key, consumer)
);
`;

export const SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE;
CREATE TABLE sim.outbox_consumer_log (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at BIGINT NOT NULL,
  CONSTRAINT uq_sim_outbox_consumer_log_key UNIQUE (idempotency_key, consumer)
);
`;
