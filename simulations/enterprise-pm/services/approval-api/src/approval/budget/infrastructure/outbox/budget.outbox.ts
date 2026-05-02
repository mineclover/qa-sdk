// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createDrizzleOutboxPort,
  type OutboxPort,
  type OutboxRecord,
} from "@qa-sdk/sim-domain-slice-kit";
import type { TransactionScope } from "@qa-sdk/sim-domain-slice-kit";
import { buildSchemaHash } from "sim-identifier-grammar";
import { approvalOutboxEvents as sqliteApprovalOutbox } from "../../../sqlite/schema.js";
import { approvalOutboxEvents as pgApprovalOutbox } from "../../../pg/schema.js";
import { withServiceVersion } from "../../../../lib/service-version.js";

export type BudgetDialect = "sqlite" | "pg";

export interface BudgetOutboxFactoryOpts {
  readonly dialect: BudgetDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

// 단계 8(Plan C): build-time schemaHash. 모듈 로드 시 1회만 계산. spec 02 §4.2.
const BUDGET_EVENT_NAME = {
  domain: "approval",
  entity: "budget",
  action: "submitted",
} as const;
const BUDGET_PAYLOAD_SHAPE = {
  id: "string",
  requesterId: "string",
  amount: "number",
  status: "string",
  currentStage: "number",
  totalStages: "number",
  occurredAt: "string",
} as const;
export const BUDGET_SCHEMA_HASH: string = buildSchemaHash({
  eventName: BUDGET_EVENT_NAME,
  payloadShape: BUDGET_PAYLOAD_SHAPE,
});

/**
 * spec 02 §4.1 + §4.2 — outbox record payload에 serviceVersion + schemaHash 첨부.
 *
 * 기존 `OutboxPort.append`를 한 번 더 감싼다. v1/v2 같은 wrap 공유 →
 * 시나리오 9(v1=v2)는 자동 성립. v2가 BUDGET_PAYLOAD_SHAPE에 필드 추가 시
 * hash 변경 → ingest schema_drift (시나리오 10).
 */
function withBudgetStamps(record: OutboxRecord): OutboxRecord {
  const stamped =
    typeof record.payload === "object" && record.payload !== null
      ? withServiceVersion({
          ...(record.payload as Record<string, unknown>),
          schemaHash: BUDGET_SCHEMA_HASH,
        })
      : withServiceVersion({
          value: record.payload,
          schemaHash: BUDGET_SCHEMA_HASH,
        });
  return { ...record, payload: stamped };
}

function wrap(port: OutboxPort): OutboxPort {
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      return port.append(withBudgetStamps(record), scope);
    },
  };
}

export function createBudgetOutboxPort(
  opts: BudgetOutboxFactoryOpts,
): OutboxPort {
  if (opts.dialect === "sqlite") {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: sqliteApprovalOutbox,
      }),
    );
  }
  if (opts.dialect === "pg") {
    return wrap(
      createDrizzleOutboxPort({
        db: opts.db as never,
        table: pgApprovalOutbox,
      }),
    );
  }
  throw new Error(
    `createBudgetOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
