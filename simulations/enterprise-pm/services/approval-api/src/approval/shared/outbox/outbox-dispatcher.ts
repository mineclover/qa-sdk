// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * spec 04 §2 — outbox dispatcher.
 *
 * 다중 replica 환경에서 같은 outbox row 를 두 번 처리하지 않도록 다음 4 단계를 결합:
 *
 *   1. 폴링 락 (§2.1): SELECT … FOR UPDATE SKIP LOCKED — 락 미보유 측은 즉시 다음 row.
 *   2. idempotency consumer-log (§2.2): INSERT … ON CONFLICT DO NOTHING RETURNING — 두
 *      dispatcher 가 같은 이벤트에 진입해도 한 행만 살아남는다.
 *   3. status 전이 가드 (§2.3): UPDATE … WHERE id=$1 AND status='pending' — 동시 UPDATE
 *      시 한 쪽 ROW_COUNT=0 자연 no-op.
 *   4. retry/backoff/DLQ (§2.3): 1s → 2s → 4s → 8s → 16s 후 retry_count > 5 → status='dlq'
 *      + DLQ 진입 자체를 outbox 이벤트(`approval.outbox.dlq-entered`)로 발행.
 *
 * idempotency_key 는 grammar #12(`buildIdempotencyKey`) 결과만 허용한다. consumer 측에서도
 * `parseIdempotencyKey` 로 한 번 더 형식을 검증해 raw 보간 row 를 즉시 throw 시킨다.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { buildIdempotencyKey, parseIdempotencyKey } from 'sim-identifier-grammar';

export interface OutboxEvent {
  readonly id: string;
  readonly aggregateId: string;
  readonly eventName: string;
  readonly payload: string;
  readonly idempotencyKey: string;
}

export type OutboxConsumer = (evt: OutboxEvent) => Promise<void>;

export interface OutboxDispatcherOptions {
  readonly db: PostgresJsDatabase;
  readonly sql: Sql;
  /** grammar #1 service prefix (예: "sim-approval-api"). UNIQUE(idempotency_key, consumer) 의 consumer 컬럼 값. */
  readonly consumerName: string;
  readonly consume: OutboxConsumer;
  /** 한 사이클당 최대 폴링 row 수 (기본 10, spec §2.5). */
  readonly batchSize: number;
  /** retry_count > maxRetries → DLQ (기본 5, spec §2.3). */
  readonly maxRetries: number;
}

/**
 * spec 04 §2.3 — 1s → 2s → 4s → 8s → 16s. 5 회 초과 시 DLQ 진입.
 */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

function backoffMs(retryCount: number): number {
  // retryCount 는 INSERT 후 증가된 값(1 이상)
  const idx = Math.max(0, Math.min(retryCount - 1, BACKOFF_MS.length - 1));
  return BACKOFF_MS[idx];
}

export interface OutboxDispatcher {
  /** 한 사이클 폴링 + 처리. 처리한 row 수 반환. */
  tick(): Promise<number>;
}

export function createOutboxDispatcher(opts: OutboxDispatcherOptions): OutboxDispatcher {
  return {
    async tick(): Promise<number> {
      let processed = 0;
      // tx 단위로 SELECT FOR UPDATE 락을 잡는다.
      // postgres.js 3.4.8 TransactionSql<{}> callable signature 회귀 우회 — typeof opts.sql 로 cast.
      await opts.sql.begin(async (txRaw) => {
        const tx = txRaw as unknown as typeof opts.sql;
        // §2.1 폴링 락 — status='pending' 또는 backoff 만료된 'failed' row 모두 대상.
        const rows = await tx<
          {
            id: string;
            aggregate_id: string;
            event_name: string;
            payload: string;
            idempotency_key: string;
          }[]
        >`
          SELECT id, aggregate_id, event_name, payload, idempotency_key
          FROM sim.approval_outbox_events
          WHERE status IN ('pending', 'failed')
            AND (next_attempt_at IS NULL OR next_attempt_at <= ${Date.now()})
          ORDER BY occurred_at
          LIMIT ${opts.batchSize}
          FOR UPDATE SKIP LOCKED`;

        for (const row of rows) {
          // grammar #12 형식 가드 — raw 보간 row 즉시 throw.
          parseIdempotencyKey(row.idempotency_key);

          const evt: OutboxEvent = {
            id: row.id,
            aggregateId: row.aggregate_id,
            eventName: row.event_name,
            payload: row.payload,
            idempotencyKey: row.idempotency_key,
          };

          try {
            // consume 먼저 실행 — 성공 시에만 §2.2 consumer-log 에 기록한다.
            // 같은 (key, consumer) 중복 INSERT race 는 ON CONFLICT 가 흡수.
            await opts.consume(evt);

            // §2.2 멱등성 키 — 다른 dispatcher 가 이미 동일 (key, consumer) 로 처리했다면
            // RETURNING 이 비어 silent skip. 우리 자신의 retry path 는 이 분기에 도달하지
            // 않는다 (실패 시 catch 분기에서 retry/dlq 처리, 성공 시에만 본 INSERT 도달).
            const claimed = await tx<{ idempotency_key: string }[]>`
              INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
              VALUES (${evt.idempotencyKey}, ${opts.consumerName}, ${Date.now()})
              ON CONFLICT (idempotency_key, consumer) DO NOTHING
              RETURNING idempotency_key`;

            // §2.3 status 전이 — AND status IN ('pending','failed') 가드로 동시성 자연 no-op.
            await tx`
              UPDATE sim.approval_outbox_events
              SET status = 'dispatched', dispatched_at = ${Date.now()}
              WHERE id = ${row.id} AND status IN ('pending', 'failed')`;

            // claimed.length === 0 이면 다른 dispatcher 가 이미 처리한 것 → 본 dispatcher 도
            // 이미 consume 했으므로 결과적으로 중복 효과 0. status 만 정리 후 다음 row.
            if (claimed.length > 0) processed++;
          } catch {
            // §2.3 retry/backoff/DLQ.
            const next = await tx<{ retry_count: number }[]>`
              UPDATE sim.approval_outbox_events
              SET retry_count = retry_count + 1
              WHERE id = ${row.id} AND status IN ('pending', 'failed')
              RETURNING retry_count`;
            const newCount = next[0]?.retry_count ?? 0;

            if (newCount > opts.maxRetries) {
              // DLQ 격리.
              await tx`
                UPDATE sim.approval_outbox_events
                SET status = 'dlq'
                WHERE id = ${row.id}`;
              // DLQ 진입 자체를 outbox 이벤트로 발행 — controller 안전 가드 카테고리 신호.
              const dlqEventName = 'approval.outbox.dlq-entered';
              const dlqId = `dlq-${row.id}`;
              // DLQ 이벤트의 idempotencyKey 도 grammar #12 형식 준수.
              // aggregateId 는 원본 row.id 를 kebab-safe 한 형태로 prefix 한다.
              const dlqOccurredAt = Date.now();
              const dlqIdempotencyKey = buildIdempotencyKey({
                aggregateId: `dlq-${row.id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                eventName: dlqEventName,
                occurredAt: dlqOccurredAt,
              });
              await tx`
                INSERT INTO sim.approval_outbox_events
                  (id, aggregate_id, event_name, event_version, payload,
                   occurred_at, scope_id, status, idempotency_key, retry_count)
                VALUES (
                  ${dlqId},
                  ${row.aggregate_id},
                  ${dlqEventName},
                  1,
                  ${JSON.stringify({ originId: row.id, eventName: row.event_name })},
                  ${dlqOccurredAt},
                  'tx-dlq',
                  'pending',
                  ${dlqIdempotencyKey},
                  0)`;
            } else {
              await tx`
                UPDATE sim.approval_outbox_events
                SET status = 'failed', next_attempt_at = ${Date.now() + backoffMs(newCount)}
                WHERE id = ${row.id}`;
            }
          }
        }
      });
      return processed;
    },
  };
}
