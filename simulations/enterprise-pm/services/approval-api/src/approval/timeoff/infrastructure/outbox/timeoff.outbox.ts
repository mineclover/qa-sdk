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

export type TimeOffDialect = "sqlite" | "pg";

export interface TimeOffOutboxFactoryOpts {
  readonly dialect: TimeOffDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

// 단계 8(Plan C): build-time schemaHash. spec 02 §4.2.
// EventName 계약: { domain, aggregate, verbPast } — sim-identifier-grammar/event-name.ts SSOT.
// timeoff aggregate 식별자는 event-vocabulary 카탈로그에 "time-off" 으로 등록되어 있다.
const TIMEOFF_EVENT_NAME = {
  domain: "approval",
  aggregate: "time-off",
  verbPast: "submitted",
} as const;
const TIMEOFF_PAYLOAD_SHAPE = {
  id: "string",
  requesterId: "string",
  startDate: "string",
  endDate: "string",
  reason: "string",
  status: "string",
  currentStage: "number",
  totalStages: "number",
  occurredAt: "string",
} as const;
export const TIMEOFF_SCHEMA_HASH: string = buildSchemaHash({
  eventName: TIMEOFF_EVENT_NAME,
  payloadShape: TIMEOFF_PAYLOAD_SHAPE,
});

function withTimeOffStamps(record: OutboxRecord): OutboxRecord {
  const stamped =
    typeof record.payload === "object" && record.payload !== null
      ? withServiceVersion({
          ...(record.payload as Record<string, unknown>),
          schemaHash: TIMEOFF_SCHEMA_HASH,
        })
      : withServiceVersion({
          value: record.payload,
          schemaHash: TIMEOFF_SCHEMA_HASH,
        });
  return { ...record, payload: stamped };
}

function wrap(port: OutboxPort): OutboxPort {
  return {
    async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
      return port.append(withTimeOffStamps(record), scope);
    },
  };
}

export function createTimeOffOutboxPort(
  opts: TimeOffOutboxFactoryOpts,
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
    `createTimeOffOutboxPort: dialect=${(opts as { dialect: string }).dialect}`,
  );
}
