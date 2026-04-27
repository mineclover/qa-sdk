// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { randomUUID } from "node:crypto";
import type { OutboxPort, OutboxRecord } from "../outbox.port.js";
import type { TransactionScope } from "../transaction.port.js";

/**
 * 어떤 객체가 drizzle insert builder 처럼 동작하면 충분하다는 구조 타입.
 *
 * drizzle 의 `db.insert(table).values(row)` 패턴을 추상화한다.
 * 실제 schema 는 kit 외부 (슬라이스 또는 서비스) 가 소유하고, 본 어댑터는
 * insert 인터페이스만 의존한다.
 */
export interface DrizzleInsertable {
  insert(table: unknown): {
    values(row: Record<string, unknown>): { execute?: () => Promise<unknown> } | Promise<unknown>;
  };
}

/**
 * Drizzle 기반 OutboxPort 의 옵션.
 *
 * - db: drizzle 인스턴스
 * - table: 슬라이스가 소유한 outbox 테이블 reference (drizzle table object)
 * - serializePayload: payload 를 컬럼에 넣기 직전 직렬화 (기본 JSON.stringify)
 */
export interface DrizzleOutboxPortOptions {
  db: DrizzleInsertable;
  table: unknown;
  serializePayload?: (payload: unknown) => unknown;
}

/**
 * Drizzle outbox INSERT 어댑터의 기본 구현.
 *
 * 컬럼명 컨벤션 (Phase 1 의 pm_outbox_events 참조):
 *   id (uuid), aggregate_id, event_name, event_version, payload (json/text),
 *   occurred_at (epoch ms), scope_id, status ('pending')
 *
 * 실제 컬럼 이름은 drizzle table object 의 필드명이 결정한다. 호출자가 schema
 * 를 정의할 때 위 컨벤션을 따르면 본 어댑터가 그대로 동작한다.
 */
export function createDrizzleOutboxPort(opts: DrizzleOutboxPortOptions): OutboxPort {
  const serialize = opts.serializePayload ?? ((p: unknown) => JSON.stringify(p));
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      const row = {
        id: randomUUID(),
        aggregate_id: record.aggregateId,
        event_name: record.eventName,
        event_version: record.eventVersion,
        payload: serialize(record.payload),
        occurred_at: record.occurredAt.getTime(),
        scope_id: scope.id,
        status: "pending" as const,
      };
      const builder = opts.db.insert(opts.table).values(row);
      // drizzle <=0.30 returns thenable directly; >=1.0 has explicit .execute()
      if (builder && typeof (builder as { execute?: unknown }).execute === "function") {
        await (builder as { execute: () => Promise<unknown> }).execute();
      } else {
        await (builder as Promise<unknown>);
      }
    },
  };
}
