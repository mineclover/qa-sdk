// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.1 — N건 outbox event 단일 트랜잭션 INSERT.
// idempotency_key 는 grammar #12 buildIdempotencyKey 결과만 허용 — raw 보간 금지.
// aggregateId 는 toGrammarSafeAggregateId 로 정규화 후 builder 에 주입.
// eventName 은 parseEventName 으로 트랜잭션 진입 전 사전 검증한다 (grammar #5).

import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  buildIdempotencyKey,
  parseEventName,
} from "sim-identifier-grammar";
import { toGrammarSafeAggregateId } from "../approval/shared/outbox/idempotency-key-source.js";
import {
  OUTBOX_ADMIN_REPO,
  type OutboxAdminRepo,
} from "./outbox-admin.tokens.js";

export interface OutboxEventInput {
  aggregateId: string;
  eventName: string;
  payload: unknown;
  occurredAt: number;
  eventVersion?: number;
}

export interface OutboxInsertResult {
  inserted: number;
  idempotencyKeys: string[];
  ids: string[];
}

@Injectable()
export class OutboxAdminInsertService {
  constructor(
    @Inject(OUTBOX_ADMIN_REPO) private readonly repo: OutboxAdminRepo,
  ) {}

  async insertEvents(events: OutboxEventInput[]): Promise<OutboxInsertResult> {
    if (events.length === 0) {
      return { inserted: 0, idempotencyKeys: [], ids: [] };
    }

    // grammar #5 사전 검증 — 트랜잭션 진입 전에 throw 시켜 부분 INSERT 를 방지한다.
    for (const e of events) {
      try {
        parseEventName(e.eventName);
      } catch (err) {
        throw new Error(
          `eventName grammar #5 violation: ${e.eventName} (${(err as Error).message})`,
        );
      }
    }

    const scopeId = `admin-insert-${Date.now()}`;
    const rows = events.map((e) => {
      const aggregate_id = toGrammarSafeAggregateId(e.aggregateId);
      const idempotency_key = buildIdempotencyKey({
        aggregateId: aggregate_id,
        eventName: e.eventName,
        occurredAt: e.occurredAt,
      });
      return {
        id: randomUUID(),
        aggregate_id,
        event_name: e.eventName,
        event_version: e.eventVersion ?? 1,
        payload:
          typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload),
        occurred_at: e.occurredAt,
        scope_id: scopeId,
        status: "pending" as const,
        idempotency_key,
        retry_count: 0,
      };
    });

    const ids = await this.repo.transaction((tx) => tx.insertMany(rows));
    return {
      inserted: ids.length,
      idempotencyKeys: rows.map((r) => r.idempotency_key),
      ids,
    };
  }
}
